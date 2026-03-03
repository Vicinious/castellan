'use strict';

const { BaseProvider } = require('./interface');
const { AnthropicProvider } = require('./anthropic');
const { OpenAIProvider } = require('./openai');
const { OllamaProvider } = require('./ollama');
const { ProviderRouter } = require('./router');

function createDefaultRouter() {
  const providers = {
    anthropic: new AnthropicProvider({}),
    openai: new OpenAIProvider({}),
    ollama: new OllamaProvider({}),
  };

  return new ProviderRouter({
    providers,
    defaultProvider: process.env.CASTELLAN_DEFAULT_PROVIDER || 'ollama',
    routingRules: [
      { match: { taskType: 'complex_reasoning' }, provider: 'anthropic', model: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest', reason: 'best_reasoning' },
      { match: { taskType: 'code_generation' }, provider: 'anthropic', model: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest', reason: 'code_quality' },
      { match: { taskType: 'simple_query' }, provider: 'ollama', model: process.env.OLLAMA_MODEL || 'llama3.1:8b', reason: 'cost_optimized' },
    ],
    fallbackChain: ['openai', 'ollama', 'anthropic'],
  });
}

module.exports = {
  BaseProvider,
  AnthropicProvider,
  OpenAIProvider,
  OllamaProvider,
  ProviderRouter,
  createDefaultRouter,
};
