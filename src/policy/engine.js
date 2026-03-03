'use strict';

class PolicyEngine {
  constructor({ workspace = process.cwd(), rules = [] } = {}) {
    this.workspace = workspace;
    this.rules = rules;
    this.calls = new Map();
  }

  _rateCheck(key, perMinute = 60) {
    const now = Date.now();
    const arr = (this.calls.get(key) || []).filter((t) => now - t < 60_000);
    if (arr.length >= perMinute) {
      this.calls.set(key, arr);
      return false;
    }
    arr.push(now);
    this.calls.set(key, arr);
    return true;
  }

  evaluate(req) {
    for (const rule of this.rules) {
      const res = rule(req, this);
      if (res) return res;
    }
    return { action: 'allow', reason: 'default_allow' };
  }
}

module.exports = { PolicyEngine };
