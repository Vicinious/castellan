'use strict';

const { BaseProvider } = require('./interface');
const fs = require('node:fs');

// Kevin's OAuth token (auto-refreshed by OpenClaw)
const KEVIN_AUTH_PATH = '/home/openclaw/.openclaw/agents/main/agent/auth-profiles.json';

class AnthropicProvider extends BaseProvider {
  constructor({ apiKey, model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514' } = {}) {
    super({ name: 'anthropic', model, supportsStreaming: true, supportsTools: true, maxContextTokens: 200000 });
    this.apiKey = apiKey || this.loadOAuthToken();
  }

  loadOAuthToken() {
    // Try Kevin's OAuth token first
    try {
      const raw = fs.readFileSync(KEVIN_AUTH_PATH, 'utf8');
      const auth = JSON.parse(raw);
      const profile = auth.profiles?.['anthropic:default'];
      if (profile?.token) {
        return profile.token;
      }
    } catch (err) {
      console.log(`[anthropic] OAuth token not available: ${err.message}`);
    }
    // Fall back to env var
    return process.env.ANTHROPIC_API_KEY;
  }

  async chat(request = {}) {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY missing (no OAuth token or env var)');

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
