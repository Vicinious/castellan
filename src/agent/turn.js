'use strict';

const { ulid } = require('../utils/ulid');
const { parseModelResponse } = require('./context');

async function processTurn({
  db,
  provider,
  messages,
  sessionId = 'default',
  inputSource = 'user',
  maxToolCalls = 10,
  toolExecutor,
  logger,
}) {
  const turnId = ulid();
  const started = Date.now();

  const userMessage = [...messages].reverse().find((m) => m.role === 'user');
  db.run(
    `INSERT INTO turns (id, role, content, input_source, session_id, started_at)
     VALUES (:id, 'user', :content, :src, :sid, datetime('now'))`,
    { id: `${turnId}-u`, content: userMessage?.content || '', src: inputSource, sid: sessionId }
  );

  const modelResp = await provider.chat({ messages, sessionId });
  const parsed = parseModelResponse(modelResp);

  const toolCalls = parsed.toolCalls.slice(0, maxToolCalls);
  const toolResults = [];

  for (const tc of toolCalls) {
    const tcId = tc.id || ulid();
    db.run(
      `INSERT INTO tool_calls (id, turn_id, tool_name, arguments_json, status, started_at, policy_decision)
       VALUES (:id,:turnId,:name,:args,'running',datetime('now'),'allow')`,
      { id: tcId, turnId, name: tc.name || 'unknown', args: JSON.stringify(tc.arguments || {}) }
    );

    try {
      const result = toolExecutor ? await toolExecutor(tc) : { skipped: true, reason: 'no_tool_executor' };
      toolResults.push({ id: tcId, name: tc.name, result });
      db.run(
        `UPDATE tool_calls SET status='success', result_json=:res, completed_at=datetime('now'), latency_ms=:lat WHERE id=:id`,
        { id: tcId, res: JSON.stringify(result), lat: 0 }
      );
    } catch (err) {
      db.run(
        `UPDATE tool_calls SET status='error', error=:err, completed_at=datetime('now') WHERE id=:id`,
        { id: tcId, err: err.message || String(err) }
      );
      toolResults.push({ id: tcId, name: tc.name, error: err.message || String(err) });
    }
  }

  db.run(
    `INSERT INTO turns (id, role, content, tool_calls_json, session_id, model, provider, started_at, completed_at, latency_ms)
     VALUES (:id, 'assistant', :content, :tc, :sid, :model, :provider, datetime('now'), datetime('now'), :lat)`,
    {
      id: turnId,
      content: parsed.text,
      tc: JSON.stringify(toolCalls),
      sid: sessionId,
      model: provider.model || 'unknown',
      provider: provider.name || 'unknown',
      lat: Date.now() - started,
    }
  );

  db.run(
    `INSERT INTO working_memory (id, entry_type, content, tokens, importance, session_id, created_at)
     VALUES (:id, 'turn', :content, :tokens, :importance, :sid, datetime('now'))`,
    { id: ulid(), content: parsed.text, tokens: Math.ceil((parsed.text || '').length / 4), importance: 0.6, sid: sessionId }
  );

  if (logger) logger.info('turn_processed', { turnId, toolCalls: toolCalls.length, latencyMs: Date.now() - started });

  return {
    turnId,
    text: parsed.text,
    toolCalls,
    toolResults,
    latencyMs: Date.now() - started,
  };
}

module.exports = { processTurn };
