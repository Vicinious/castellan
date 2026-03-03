'use strict';

const { BaseProvider } = require('./interface');

class OllamaProvider extends BaseProvider {
  constructor({ baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434', model = process.env.OLLAMA_MODEL || 'llama3.1:8b' } = {}) {
    super({ name: 'ollama', model, supportsStreaming: false, supportsTools: false, maxContextTokens: 32000 });
    this.baseUrl = baseUrl;
  }

  async chat(request = {}) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: request.model || this.model,
        messages: request.messages || [],
        stream: false,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Ollama error ${res.status}`);

    return {
      provider: this.name,
      model: request.model || this.model,
      text: data?.message?.content || '',
      raw: data,
      usage: null,
      toolCalls: [],
    };
  }
}

module.exports = { OllamaProvider };
