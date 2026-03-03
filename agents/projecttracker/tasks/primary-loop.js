'use strict';

async function primaryLoopTask({ db, logger, taskName = 'primary_loop', summary = 'ok' }) {
  if (db) {
    db.run(
      `INSERT INTO metrics (id, name, value, unit, dimensions_json, recorded_at)
       VALUES (:id,:name,:value,'count',:dims,datetime('now'))`,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        name: `agent_${taskName}_runs`,
        value: 1,
        dims: JSON.stringify({ summary }),
      }
    );
  }
  logger?.info?.('agent_primary_loop_ok', { taskName, summary });
  return { ok: true, taskName, summary };
}

module.exports = { primaryLoopTask };
