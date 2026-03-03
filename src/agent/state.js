'use strict';

const STATES = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  SLEEPING: 'sleeping',
  ERROR: 'error',
});

class AgentStateStore {
  constructor({ maxConsecutiveErrors = 5, maxRepetitiveTurns = 3 } = {}) {
    this.state = STATES.IDLE;
    this.maxConsecutiveErrors = maxConsecutiveErrors;
    this.maxRepetitiveTurns = maxRepetitiveTurns;
    this.consecutiveErrors = 0;
    this.lastTurnSignature = null;
    this.repetitiveCount = 0;
    this.lastError = null;
  }

  transition(next) {
    this.state = next;
  }

  onTurnStart() {
    this.transition(STATES.RUNNING);
  }

  onTurnSuccess(signature) {
    this.consecutiveErrors = 0;
    this._updateRepetitive(signature);
    this.transition(STATES.IDLE);
  }

  onTurnError(err) {
    this.consecutiveErrors += 1;
    this.lastError = err?.message || String(err);
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      this.transition(STATES.ERROR);
      return;
    }
    this.transition(STATES.IDLE);
  }

  _updateRepetitive(signature) {
    if (!signature) return;
    if (this.lastTurnSignature === signature) this.repetitiveCount += 1;
    else this.repetitiveCount = 0;
    this.lastTurnSignature = signature;
    if (this.repetitiveCount >= this.maxRepetitiveTurns) this.transition(STATES.ERROR);
  }

  snapshot() {
    return {
      state: this.state,
      consecutiveErrors: this.consecutiveErrors,
      repetitiveCount: this.repetitiveCount,
      lastError: this.lastError,
    };
  }
}

module.exports = { STATES, AgentStateStore };
