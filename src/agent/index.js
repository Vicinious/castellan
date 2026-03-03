'use strict';

const { AgentLoop } = require('./loop');

function createMockProvider() {
  return {
    name: 'mock',
    model: 'mock-react-v1',
    async chat({ messages }) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const text = `Acknowledged: ${lastUser?.content || 'no input'}`;
      return { text, toolCalls: [] };
    },
  };
}

function createAgentCore({ db, logger, provider, config = {} }) {
  const core = new AgentLoop({
    db,
    logger,
    provider: provider || createMockProvider(),
    maxToolCallsPerTurn: config.maxToolCallsPerTurn ?? 10,
    maxConsecutiveErrors: config.maxConsecutiveErrors ?? 5,
    maxRepetitiveTurns: config.maxRepetitiveTurns ?? 3,
    turnTimeoutMs: config.turnTimeoutMs ?? 120000,
    systemPrompt: config.systemPrompt,
    toolExecutor: config.toolExecutor,
  });

  return core;
}

module.exports = { createAgentCore, createMockProvider };
