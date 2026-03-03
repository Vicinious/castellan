'use strict';

const { ulid } = require('../../utils/ulid');

async function healthCheckTask({ db }) {
  const state = db.get(`SELECT state, total_turns, total_tool_calls, total_tokens_used FROM agent_state WHERE id=1`) || {};
  db.run(
    `INSERT INTO metrics (id, name, value, unit, dimensions_json, recorded_at)
     VALUES (:id,'agent_health',:value,'score',:dims,datetime('now'))`,
    {
      id: ulid(),
      value: state.state === 'error' ? 0 : 1,
      dims: JSON.stringify({ state: state.state || 'unknown', turns: state.total_turns || 0 }),
    }
  );
  return { ok: true, state: state.state || 'unknown' };
}

module.exports = { healthCheckTask };
