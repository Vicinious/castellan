'use strict';

const { AgentStateStore, STATES } = require('./state');
const { assembleContext } = require('./context');
const { processTurn } = require('./turn');

class AgentLoop {
  constructor({
    db,
    provider,
    logger,
    maxToolCallsPerTurn = 10,
    maxConsecutiveErrors = 5,
    maxRepetitiveTurns = 3,
    turnTimeoutMs = 120000,
    systemPrompt,
    toolExecutor,
  }) {
    this.db = db;
    this.provider = provider;
    this.logger = logger;
    this.maxToolCallsPerTurn = maxToolCallsPerTurn;
    this.turnTimeoutMs = turnTimeoutMs;
    this.systemPrompt = systemPrompt;
    this.toolExecutor = toolExecutor;
    this.state = new AgentStateStore({ maxConsecutiveErrors, maxRepetitiveTurns });
  }

  isRunning() { return this.state.snapshot().state === STATES.RUNNING; }
  getState() { return this.state.snapshot(); }

  async wake(reason = 'manual_trigger') {
    this.db.run(`UPDATE agent_state SET state='running', last_wake_at=datetime('now'), updated_at=datetime('now') WHERE id=1`);
    this.db.run(`INSERT INTO wake_events (id, reason, payload_json, created_at) VALUES (:id,:reason,:payload,datetime('now'))`, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      reason,
      payload: JSON.stringify({ reason }),
    });
  }

  async sleep() {
    this.state.transition(STATES.SLEEPING);
    this.db.run(`UPDATE agent_state SET state='sleeping', last_sleep_at=datetime('now'), updated_at=datetime('now') WHERE id=1`);
  }

  async run(input, { sessionId = 'default', inputSource = 'user' } = {}) {
    this.state.onTurnStart();
    this.db.run(`UPDATE agent_state SET state='running', updated_at=datetime('now') WHERE id=1`);

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('turn_timeout')), this.turnTimeoutMs));

    try {
      const { messages } = assembleContext({ db: this.db, input, sessionId, systemPrompt: this.systemPrompt });
      const result = await Promise.race([
        processTurn({
          db: this.db,
          provider: this.provider,
          logger: this.logger,
          messages,
          sessionId,
          inputSource,
          maxToolCalls: this.maxToolCallsPerTurn,
          toolExecutor: this.toolExecutor,
        }),
        timeoutPromise,
      ]);

      const signature = `${(result.text || '').slice(0, 120)}::${result.toolCalls.length}`;
      this.state.onTurnSuccess(signature);

      this.db.run(
        `UPDATE agent_state SET state='idle', total_turns=total_turns+1, total_tool_calls=total_tool_calls+:tools, updated_at=datetime('now') WHERE id=1`,
        { tools: result.toolCalls.length }
      );

      return result;
    } catch (err) {
      this.state.onTurnError(err);
      this.db.run(`UPDATE agent_state SET state='error', last_error=:err, updated_at=datetime('now') WHERE id=1`, { err: err.message || String(err) });
      if (this.logger) this.logger.error('agent_turn_failed', { error: err.message || String(err) });
      throw err;
    }
  }
}

module.exports = { AgentLoop };
