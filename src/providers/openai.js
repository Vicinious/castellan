'use strict';

const { BaseProvider } = require('./interface');

class OpenAIProvider extends BaseProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || 'gpt-4o-mini' } = {}) {
    super({ name: 'openai', model, supportsStreaming: true, supportsTools: true, maxContextTokens: 128000 });
    this.apiKey = apiKey;
  }

  async chat(request = {}) {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY missing');
    const messages = Array.isArray(request.messages) ? request.messages : [];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.model,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens || 800,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `OpenAI error ${res.status}`);

    const choice = data?.choices?.[0]?.message || {};
    return {
      provider: this.name,
      model: request.model || this.model,
      text: choice.content || '',
      raw: data,
      usage: data.usage || null,
      toolCalls: choice.tool_calls || [],
    };
  }
}

module.exports = { OpenAIProvider };
