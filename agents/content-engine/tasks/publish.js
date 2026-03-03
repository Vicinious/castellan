'use strict';

async function publishScheduledTask({ db, config, logger }) {
  if (!config.content?.autoPublish) {
    if (logger) logger.info('publish_skipped', { reason: 'auto_publish_disabled' });
    return { ok: true, skipped: true, reason: 'auto_publish_disabled' };
  }

  // Get drafts marked for publishing
  if (!db) {
    return { ok: false, error: 'no_db' };
  }

  const rows = db.all(
    `SELECT key, value FROM kv_store 
     WHERE namespace = 'content_drafts'
     AND json_extract(value, '$.status') = 'approved'
     ORDER BY created_at ASC`
  );

  if (rows.length === 0) {
    if (logger) logger.info('publish_skipped', { reason: 'no_approved_drafts' });
    return { ok: true, published: 0 };
  }

  let published = 0;
  const results = [];

  for (const row of rows) {
    const draft = JSON.parse(row.value);
    
    // TODO: Implement actual CMS publishing
    // For now, just mark as published
    draft.status = 'published';
    draft.publishedAt = new Date().toISOString();

    db.run(
      `UPDATE kv_store SET value = :value WHERE key = :key`,
      { key: row.key, value: JSON.stringify(draft) }
    );

    published++;
    results.push({ title: draft.title, status: 'published' });

    if (logger) logger.info('content_published', { title: draft.title });
  }

  return { ok: true, published, results };
}

module.exports = { publishScheduledTask };
