'use strict';

async function diskCleanupTask({ execTool, logger }) {
  const commands = [
    'journalctl --vacuum-time=7d',
    'find /tmp -type f -mtime +3 -delete'
  ];

  const results = [];
  for (const command of commands) {
    try {
      const res = await execTool({ command });
      results.push({ command, ok: true, output: String(res?.stdout || '').slice(0, 200) });
    } catch (err) {
      results.push({ command, ok: false, error: err.message || String(err) });
    }
  }

  const ok = results.every((r) => r.ok);
  if (!ok && logger) logger.warn('fleetguard_cleanup_partial', { results });
  return { ok, results };
}

module.exports = { diskCleanupTask };
