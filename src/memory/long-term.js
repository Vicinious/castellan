'use strict';

const { ulid } = require('../utils/ulid');

class LongTermMemory {
  constructor({ db, defaultConfidence = 0.8 } = {}) {
    this.db = db;
    this.defaultConfidence = defaultConfidence;
  }

  storeFact(fact) {
    const id = fact.id || ulid();
    this.db.run(
      `INSERT INTO long_term_memory (id, category, subject, predicate, object, confidence, source, created_at, updated_at)
       VALUES (:id,:category,:subject,:predicate,:object,:confidence,:source,datetime('now'),datetime('now'))`,
      {
        id,
        category: fact.category || 'technical',
        subject: String(fact.subject || ''),
        predicate: String(fact.predicate || ''),
        object: String(fact.object || ''),
        confidence: fact.confidence ?? this.defaultConfidence,
        source: fact.source || null,
      }
    );
    return id;
  }

  recallFacts(query, { category = null, limit = 10, minConfidence = 0.5 } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    let rows = [];
    try {
      if (category) {
        rows = this.db.all(
          `SELECT m.*, bm25(long_term_memory_fts) AS relevance
           FROM long_term_memory m
           JOIN long_term_memory_fts fts ON m.rowid = fts.rowid
           WHERE long_term_memory_fts MATCH :q
             AND m.category = :category
             AND m.confidence >= :minConfidence
           ORDER BY relevance
           LIMIT :limit`,
          { q, category, minConfidence, limit }
        );
      } else {
        rows = this.db.all(
          `SELECT m.*, bm25(long_term_memory_fts) AS relevance
           FROM long_term_memory m
           JOIN long_term_memory_fts fts ON m.rowid = fts.rowid
           WHERE long_term_memory_fts MATCH :q
             AND m.confidence >= :minConfidence
           ORDER BY relevance
           LIMIT :limit`,
          { q, minConfidence, limit }
        );
      }
    } catch {
      const like = `%${q.replace(/[%_]/g, '')}%`;
      if (category) {
        rows = this.db.all(
          `SELECT * FROM long_term_memory
           WHERE category=:category
             AND confidence>=:minConfidence
             AND (subject LIKE :like OR predicate LIKE :like OR object LIKE :like)
           ORDER BY datetime(updated_at) DESC
           LIMIT :limit`,
          { category, minConfidence, like, limit }
        );
      } else {
        rows = this.db.all(
          `SELECT * FROM long_term_memory
           WHERE confidence>=:minConfidence
             AND (subject LIKE :like OR predicate LIKE :like OR object LIKE :like)
           ORDER BY datetime(updated_at) DESC
           LIMIT :limit`,
          { minConfidence, like, limit }
        );
      }
    }

    for (const r of rows) {
      this.db.run(
        `UPDATE long_term_memory
         SET access_count = access_count + 1,
             last_accessed_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = :id`,
        { id: r.id }
      );
    }

    return rows;
  }

  updateFact(id, updates = {}) {
    const current = this.db.get(`SELECT * FROM long_term_memory WHERE id=:id`, { id });
    if (!current) return false;
    this.db.run(
      `UPDATE long_term_memory
       SET category=:category, subject=:subject, predicate=:predicate, object=:object,
           confidence=:confidence, source=:source, updated_at=datetime('now')
       WHERE id=:id`,
      {
        id,
        category: updates.category ?? current.category,
        subject: updates.subject ?? current.subject,
        predicate: updates.predicate ?? current.predicate,
        object: updates.object ?? current.object,
        confidence: updates.confidence ?? current.confidence,
        source: updates.source ?? current.source,
      }
    );
    return true;
  }
}

module.exports = { LongTermMemory };
