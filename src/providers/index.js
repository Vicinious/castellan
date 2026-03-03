'use strict';

const { BaseProvider } = require('./interface');
const { AnthropicProvider } = require('./anthropic');
const { OpenAIProvider } = require('./openai');
const { OllamaProvider } = require('./ollama');
const { ProviderRouter } = require('./router');

function createDefaultRouter() {
  const providers = {
    anthropic: new AnthropicProvider({ 
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    }),
    openai: new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4.1-nano'
    }),
    ollama: new OllamaProvider({ 
      model: process.env.OLLAMA_MODEL || 'llama3.2:3b' 
    }),
  };

  // Priority: Claude for complex tasks, Ollama for simple, OpenAI as backup
  return new ProviderRouter({
    providers,
    defaultProvider: process.env.CASTELLAN_DEFAULT_PROVIDER || 'anthropic',
    routingRules: [
      { match: { taskType: 'complex_reasoning' }, provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: 'best_reasoning' },
      { match: { taskType: 'code_generation' }, provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: 'code_quality' },
      { match: { taskType: 'simple_query' }, provider: 'ollama', model: 'llama3.2:3b', reason: 'cost_optimized' },
    ],
    fallbackChain: ['openai', 'ollama'],
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
