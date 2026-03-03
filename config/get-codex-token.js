#!/usr/bin/env node
const fs = require('fs');
const MONKEY_AUTH = '/home/openclaw-monkey/.openclaw/agents/main/agent/auth-profiles.json';

try {
  const auth = JSON.parse(fs.readFileSync(MONKEY_AUTH, 'utf8'));
  const codex = auth.profiles['openai-codex:default'];
  if (codex) {
    console.log(JSON.stringify({
      access: codex.access,
      refresh: codex.refresh,
      expires: codex.expires
    }));
  }
} catch (e) {
  console.error('Failed to read Monkey auth:', e.message);
  process.exit(1);
}
