'use strict';

const { ulid } = require('../../utils/ulid');

async function metricSnapshotTask({ db }) {
  const toolCalls = db.get(`SELECT COUNT(*) as c FROM tool_calls WHERE datetime(started_at) >= datetime('now','-15 minutes')`)?.c || 0;
  const turns = db.get(`SELECT COUNT(*) as c FROM turns WHERE datetime(started_at) >= datetime('now','-15 minutes')`)?.c || 0;

  db.run(
    `INSERT INTO metrics (id, name, value, unit, dimensions_json, period_start, period_end, recorded_at)
     VALUES (:id,'turns_15m',:turns,'count',:dims,datetime('now','-15 minutes'),datetime('now'),datetime('now'))`,
    { id: ulid(), turns, dims: JSON.stringify({ toolCalls }) }
  );

  return { ok: true, turns, toolCalls };
}

module.exports = { metricSnapshotTask };
