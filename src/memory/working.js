'use strict';

const { ulid } = require('../utils/ulid');

class WorkingMemory {
  constructor({ db, defaultSessionId = 'default', maxEntries = 200 } = {}) {
    this.db = db;
    this.defaultSessionId = defaultSessionId;
    this.maxEntries = maxEntries;
  }

  add(entry, sessionId = this.defaultSessionId) {
    const id = entry.id || ulid();
    const tokens = entry.tokens ?? Math.ceil(String(entry.content || '').length / 4);
    const importance = entry.importance ?? 0.5;
    this.db.run(
      `INSERT INTO working_memory (id, entry_type, content, tokens, importance, session_id, created_at, expires_at)
       VALUES (:id,:type,:content,:tokens,:importance,:sid,datetime('now'),:expires_at)`,
      {
        id,
        type: entry.type || entry.entry_type || 'context',
        content: String(entry.content || ''),
        tokens,
        importance,
        sid: sessionId,
        expires_at: entry.expires_at || null,
      }
    );
    return id;
  }

  list(sessionId = this.defaultSessionId, limit = 50) {
    return this.db.all(
      `SELECT * FROM working_memory WHERE session_id=:sid ORDER BY datetime(created_at) DESC LIMIT :n`,
      { sid: sessionId, n: limit }
    );
  }

  getContext(sessionId = this.defaultSessionId, tokenBudget = 8000) {
    const rows = this.list(sessionId, this.maxEntries).reverse();
    const picked = [];
    let used = 0;
    for (const r of rows) {
      const t = Number(r.tokens || 0);
      if (used + t > tokenBudget) continue;
      picked.push(r);
      used += t;
    }
    return { entries: picked, tokenUsage: used, text: picked.map((r) => r.content).join('\n') };
  }

  prune(sessionId = this.defaultSessionId, keepLast = this.maxEntries) {
    const rows = this.db.all(
      `SELECT id, importance, created_at FROM working_memory WHERE session_id=:sid ORDER BY datetime(created_at) DESC`,
      { sid: sessionId }
    );
    if (rows.length <= keepLast) return { removed: 0 };

    const keep = new Set(rows.slice(0, keepLast).map((r) => r.id));
    const removable = rows.slice(keepLast).sort((a, b) => Number(a.importance) - Number(b.importance));
    for (const r of removable) {
      if (!keep.has(r.id)) this.db.run(`DELETE FROM working_memory WHERE id=:id`, { id: r.id });
    }
    return { removed: removable.length };
  }

  clear(sessionId = this.defaultSessionId) {
    const res = this.db.run(`DELETE FROM working_memory WHERE session_id=:sid`, { sid: sessionId });
    return { removed: Number(res.changes || 0) };
  }
}

module.exports = { WorkingMemory };
