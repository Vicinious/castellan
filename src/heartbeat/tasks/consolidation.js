'use strict';

async function memoryConsolidationTask({ memorySystem, sessionId = 'default' }) {
  if (!memorySystem) return { ok: false, skipped: true, reason: 'memorySystem_missing' };
  const result = await memorySystem.consolidate({ sessionId, keepRecent: 20 });
  return { ok: true, ...result };
}

module.exports = { memoryConsolidationTask };
