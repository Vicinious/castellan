'use strict';

const { ulid } = require('../utils/ulid');

function createWakeEvent(db, reason, payload = {}) {
  const id = ulid();
  db.run(
    `INSERT INTO wake_events (id, reason, payload_json, processed, created_at)
     VALUES (:id,:reason,:payload,0,datetime('now'))`,
    { id, reason, payload: JSON.stringify(payload) }
  );
  return id;
}

function listPendingWakeEvents(db, limit = 20) {
  return db.all(
    `SELECT * FROM wake_events WHERE processed=0 ORDER BY datetime(created_at) ASC LIMIT :n`,
    { n: limit }
  );
}

function markWakeProcessed(db, id) {
  db.run(
    `UPDATE wake_events SET processed=1, processed_at=datetime('now') WHERE id=:id`,
    { id }
  );
}

module.exports = { createWakeEvent, listPendingWakeEvents, markWakeProcessed };
