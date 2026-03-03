'use strict';

function validateArgs(schema = {}, args = {}) {
  const required = schema.required || [];
  for (const r of required) {
    if (!(r in args)) return { ok: false, error: `Missing required arg: ${r}` };
  }

  for (const [key, spec] of Object.entries(schema.properties || {})) {
    if (!(key in args)) continue;
    const val = args[key];
    if (spec.type === 'string' && typeof val !== 'string') return { ok: false, error: `Arg ${key} must be string` };
    if (spec.type === 'number' && typeof val !== 'number') return { ok: false, error: `Arg ${key} must be number` };
    if (spec.type === 'boolean' && typeof val !== 'boolean') return { ok: false, error: `Arg ${key} must be boolean` };
  }

  return { ok: true };
}

module.exports = { validateArgs };
