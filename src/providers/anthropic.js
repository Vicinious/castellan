'use strict';

const { BaseProvider } = require('./interface');

class AnthropicProvider extends BaseProvider {
  constructor({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest' } = {}) {
    super({ name: 'anthropic', model, supportsStreaming: true, supportsTools: true, maxContextTokens: 200000 });
    this.apiKey = apiKey;
  }

  async chat(request = {}) {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY missing');

    const messages = Array.isArray(request.messages) ? request.messages : [];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model || this.model,
        max_tokens: request.maxTokens || 800,
        temperature: request.temperature ?? 0.2,
        messages: messages.map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic error ${res.status}`);

    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return {
      provider: this.name,
      model: request.model || this.model,
      text,
      raw: data,
      usage: data.usage || null,
      toolCalls: [],
    };
  }
}

module.exports = { AnthropicProvider };
