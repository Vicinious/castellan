'use strict';

const { BaseProvider } = require('./interface');
const fs = require('node:fs');
const path = require('node:path');

// Read from Monkey's live auth (auto-refreshed by OpenClaw)
const MONKEY_AUTH_PATH = '/home/openclaw-monkey/.openclaw/agents/main/agent/auth-profiles.json';
const CREDENTIALS_PATH = path.join(__dirname, '../../config/credentials.json');
const TOKEN_REFRESH_URL = 'https://auth.openai.com/oauth/token';
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'; // Codex CLI client

class CodexProvider extends BaseProvider {
  constructor(opts = {}) {
    super({ 
      name: 'codex', 
      model: opts.model || 'gpt-5.2-codex', 
      supportsStreaming: true, 
      supportsTools: true, 
      maxContextTokens: 128000 
    });
    this.credentials = null;
    this.credentialsPath = opts.credentialsPath || CREDENTIALS_PATH;
  }

  loadCredentials() {
    if (!this.credentials) {
      // Try Monkey's live auth first (auto-refreshed by OpenClaw)
      try {
        const raw = fs.readFileSync(MONKEY_AUTH_PATH, 'utf8');
        const all = JSON.parse(raw);
        const profile = all.profiles?.['openai-codex:default'];
        if (profile?.access) {
          this.credentials = {
            type: 'oauth',
            access: profile.access,
            refresh: profile.refresh,
            expires: profile.expires,
            model: 'gpt-5.2-codex'
          };
          return this.credentials;
        }
      } catch (err) {
        console.log(`[codex] Monkey auth not available: ${err.message}, trying local config`);
      }
      
      // Fall back to local credentials file
      try {
        const raw = fs.readFileSync(this.credentialsPath, 'utf8');
        const all = JSON.parse(raw);
        this.credentials = all['openai-codex'];
      } catch (err) {
        throw new Error(`Failed to load Codex credentials: ${err.message}`);
      }
    }
    return this.credentials;
  }

  saveCredentials(updated) {
    try {
      const raw = fs.readFileSync(this.credentialsPath, 'utf8');
      const all = JSON.parse(raw);
      all['openai-codex'] = { ...all['openai-codex'], ...updated };
      fs.writeFileSync(this.credentialsPath, JSON.stringify(all, null, 2));
      this.credentials = all['openai-codex'];
    } catch (err) {
      console.error(`Failed to save credentials: ${err.message}`);
    }
  }

  isExpired() {
    const creds = this.loadCredentials();
    // Refresh 5 minutes before expiry
    return Date.now() > (creds.expires - 300000);
  }

  async refreshToken() {
    const creds = this.loadCredentials();
    if (!creds.refresh) throw new Error('No refresh token available');

    const res = await fetch(TOKEN_REFRESH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh,
        client_id: CLIENT_ID,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error_description || `Token refresh failed: ${res.status}`);

    const updated = {
      access: data.access_token,
      refresh: data.refresh_token || creds.refresh,
      expires: Date.now() + (data.expires_in * 1000),
    };
    
    this.saveCredentials(updated);
    console.log(`[codex] Token refreshed, expires: ${new Date(updated.expires).toISOString()}`);
    return updated.access;
  }

  async getAccessToken() {
    if (this.isExpired()) {
      return await this.refreshToken();
    }
    return this.loadCredentials().access;
  }

  async chat(request = {}) {
    const token = await this.getAccessToken();
    const messages = Array.isArray(request.messages) ? request.messages : [];
    const model = request.model || this.credentials?.model || this.model;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens || 2048,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // If 401, try refresh once
      if (res.status === 401) {
        console.log('[codex] Got 401, attempting token refresh...');
        const newToken = await this.refreshToken();
        return this.chat({ ...request, _retried: true });
      }
      throw new Error(data?.error?.message || `Codex error ${res.status}`);
    }

    const choice = data?.choices?.[0]?.message || {};
    return {
      provider: this.name,
      model,
      text: choice.content || '',
      raw: data,
      usage: data.usage || null,
      toolCalls: choice.tool_calls || [],
    };
  }
}

module.exports = { CodexProvider };
