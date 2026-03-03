'use strict';

async function staleCleanupTask({ db }) {
  const res = db.run(
    `DELETE FROM working_memory
     WHERE expires_at IS NOT NULL
       AND datetime(expires_at) <= datetime('now')`
  );
  return { ok: true, removed: Number(res.changes || 0) };
}

module.exports = { staleCleanupTask };
