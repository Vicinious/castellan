'use strict';

const { ulid } = require('../utils/ulid');

function extractFactsFromText(text) {
  const lines = String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const facts = [];
  for (const line of lines) {
    // naive extraction patterns for phase-3 baseline
    const m1 = line.match(/^(.+?)\s+is\s+(.+)$/i);
    if (m1) {
      facts.push({
        id: ulid(),
        category: 'technical',
        subject: m1[1].slice(0, 120),
        predicate: 'is',
        object: m1[2].slice(0, 200),
        confidence: 0.65,
      });
      continue;
    }
    if (line.length > 20 && line.length < 240) {
      facts.push({
        id: ulid(),
        category: 'technical',
        subject: 'note',
        predicate: 'contains',
        object: line.slice(0, 220),
        confidence: 0.55,
      });
    }
  }
  return facts.slice(0, 15);
}

async function consolidateMemory({ db, sessionId = 'default', keepRecent = 20 } = {}) {
  const rows = db.all(
    `SELECT * FROM working_memory
     WHERE session_id=:sid
     ORDER BY datetime(created_at) DESC`,
    { sid: sessionId }
  );

  if (rows.length <= keepRecent) {
    return { consolidated: 0, removed: 0, skipped: true };
  }

  const stale = rows.slice(keepRecent).reverse();
  let consolidated = 0;

  for (const r of stale) {
    const facts = extractFactsFromText(r.content);
    for (const f of facts) {
      db.run(
        `INSERT INTO long_term_memory (id, category, subject, predicate, object, confidence, source, created_at, updated_at)
         VALUES (:id,:category,:subject,:predicate,:object,:confidence,:source,datetime('now'),datetime('now'))`,
        {
          id: f.id,
          category: f.category,
          subject: f.subject,
          predicate: f.predicate,
          object: f.object,
          confidence: f.confidence,
          source: r.id,
        }
      );
      consolidated++;
    }
  }

  for (const r of stale) {
    db.run(`DELETE FROM working_memory WHERE id=:id`, { id: r.id });
  }

  return { consolidated, removed: stale.length, skipped: false };
}

module.exports = { extractFactsFromText, consolidateMemory };
