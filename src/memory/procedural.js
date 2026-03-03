'use strict';

const { ulid } = require('../utils/ulid');

class ProceduralMemory {
  constructor({ db } = {}) {
    this.db = db;
  }

  storeProcedure(proc) {
    const id = proc.id || ulid();
    this.db.run(
      `INSERT INTO procedural_memory (id, name, description, trigger_pattern, steps_json, created_at, updated_at)
       VALUES (:id,:name,:description,:trigger,:steps,datetime('now'),datetime('now'))
       ON CONFLICT(name) DO UPDATE SET
         description=excluded.description,
         trigger_pattern=excluded.trigger_pattern,
         steps_json=excluded.steps_json,
         updated_at=datetime('now')`,
      {
        id,
        name: proc.name,
        description: proc.description,
        trigger: proc.trigger || proc.trigger_pattern || proc.name,
        steps: JSON.stringify(proc.steps || []),
      }
    );
    return id;
  }

  recallProcedures(task, { limit = 5 } = {}) {
    const q = `%${String(task || '').toLowerCase()}%`;
    return this.db.all(
      `SELECT * FROM procedural_memory
       WHERE lower(name) LIKE :q OR lower(description) LIKE :q OR lower(trigger_pattern) LIKE :q
       ORDER BY success_rate DESC, usage_count DESC, datetime(updated_at) DESC
       LIMIT :limit`,
      { q, limit }
    );
  }

  recordUsage(id, success = true) {
    const field = success ? 'success_count' : 'failure_count';
    this.db.run(
      `UPDATE procedural_memory
       SET ${field} = ${field} + 1,
           usage_count = usage_count + 1,
           last_used_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id=:id`,
      { id }
    );
  }
}

module.exports = { ProceduralMemory };
