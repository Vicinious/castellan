'use strict';

const { PolicyEngine } = require('./engine');
const defaults = require('./rules/defaults');

function createDefaultPolicy({ workspace } = {}) {
  return new PolicyEngine({
    workspace,
    rules: [defaults.denyDestructiveExec, defaults.pathGuard, defaults.rateLimits],
  });
}

module.exports = { PolicyEngine, createDefaultPolicy };
