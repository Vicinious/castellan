'use strict';

function denyDestructiveExec(req) {
  if (req.toolName !== 'exec') return null;
  const cmd = String(req.args?.command || '');
  if (/rm\s+-rf\s+\//.test(cmd) || /mkfs/.test(cmd) || /dd\s+if=.*of=\/dev/.test(cmd)) {
    return { action: 'deny', reason: 'destructive_command' };
  }
  if (/curl.*\|.*sh|wget.*\|.*bash/.test(cmd)) {
    return { action: 'deny', reason: 'pipe_to_shell' };
  }
  if (/sudo|git\s+push\s+--force/.test(cmd)) {
    return { action: 'escalate', reason: 'high_risk_command' };
  }
  return null;
}

function pathGuard(req, engine) {
  if (!['read_file', 'write_file', 'delete_file'].includes(req.toolName)) return null;
  const p = String(req.args?.path || '');
  if (/^\/(etc|root|proc|sys)\b/.test(p)) return { action: 'deny', reason: 'protected_path' };
  if (p && p.startsWith('/') && !p.startsWith(engine.workspace)) return { action: 'deny', reason: 'outside_workspace' };
  if (/\.env$|\/secrets\//.test(p)) return { action: 'escalate', reason: 'sensitive_path' };
  return null;
}

function rateLimits(req, engine) {
  const limits = { exec: 20, write_file: 50, web_fetch: 30, web_search: 30 };
  const limit = limits[req.toolName];
  if (!limit) return null;
  const ok = engine._rateCheck(req.toolName, limit);
  if (!ok) return { action: 'quarantine', reason: 'rate_limited' };
  return null;
}

module.exports = { denyDestructiveExec, pathGuard, rateLimits };
