'use strict';

function safeParseJson(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function assembleContext({ db, input, sessionId = 'default', systemPrompt, limits = {} }) {
  const workingLimit = limits.workingLimit ?? 12;
  const longTermLimit = limits.longTermLimit ?? 8;
  const proceduralLimit = limits.proceduralLimit ?? 4;

  const working = db.all(
    `SELECT content FROM working_memory WHERE session_id=:sid ORDER BY datetime(created_at) DESC LIMIT :n`,
    { sid: sessionId, n: workingLimit }
  ).map((r) => r.content).reverse();

  const longTerm = db.all(
    `SELECT subject, predicate, object FROM long_term_memory ORDER BY access_count DESC, datetime(updated_at) DESC LIMIT :n`,
    { n: longTermLimit }
  ).map((r) => `${r.subject} ${r.predicate} ${r.object}`);

  const procedures = db.all(
    `SELECT name, description FROM procedural_memory ORDER BY success_rate DESC, usage_count DESC LIMIT :n`,
    { n: proceduralLimit }
  ).map((r) => `${r.name}: ${r.description}`);

  const messages = [
    { role: 'system', content: systemPrompt || 'You are Castellan agent core. Think step-by-step, be safe, use tools only when needed.' },
  ];

  if (longTerm.length) messages.push({ role: 'system', content: `Long-term memory:\n- ${longTerm.join('\n- ')}` });
  if (procedures.length) messages.push({ role: 'system', content: `Procedural memory:\n- ${procedures.join('\n- ')}` });
  for (const w of working) messages.push({ role: 'assistant', content: w });

  if (typeof input === 'string') messages.push({ role: 'user', content: input });
  else if (input && typeof input === 'object') {
    if (input.messages && Array.isArray(input.messages)) {
      for (const m of input.messages) if (m?.role && m?.content) messages.push({ role: m.role, content: m.content });
    } else if (input.content) {
      messages.push({ role: input.role || 'user', content: input.content });
    } else {
      messages.push({ role: 'user', content: JSON.stringify(input) });
    }
  }

  return { messages, meta: { workingCount: working.length, longTermCount: longTerm.length, proceduralCount: procedures.length } };
}

function parseModelResponse(resp) {
  if (typeof resp === 'string') return { text: resp, toolCalls: [] };
  if (!resp || typeof resp !== 'object') return { text: '', toolCalls: [] };
  const text = resp.text || resp.content || '';
  const toolCalls = Array.isArray(resp.toolCalls) ? resp.toolCalls : (Array.isArray(resp.tool_calls) ? resp.tool_calls : []);
  return { text, toolCalls };
}

module.exports = { assembleContext, parseModelResponse, safeParseJson };
