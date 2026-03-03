'use strict';

async function checkFollowupsTask({ db, config, logger }) {
  if (!db) {
    return { ok: false, error: 'no_db' };
  }

  const reminderDays = config.followups?.reminderAfterDays || 3;
  const maxReminders = config.followups?.maxReminders || 2;

  // Find emails needing follow-up
  const rows = db.all(
    `SELECT key, value FROM kv_store 
     WHERE namespace = 'inbox_triage'
     AND json_extract(value, '$.needsReply') = 1
     AND json_extract(value, '$.replied') IS NULL
     AND datetime(json_extract(value, '$.processedAt')) < datetime('now', '-${reminderDays} days')
     AND (json_extract(value, '$.reminderCount') IS NULL 
          OR json_extract(value, '$.reminderCount') < ${maxReminders})`
  );

  if (rows.length === 0) {
    if (logger) logger.info('followups_none_due');
    return { ok: true, reminders: 0 };
  }

  const overdue = [];

  for (const row of rows) {
    const triage = JSON.parse(row.value);
    
    triage.reminderCount = (triage.reminderCount || 0) + 1;
    triage.lastReminder = new Date().toISOString();

    db.run(
      `UPDATE kv_store SET value = :value WHERE key = :key`,
      { key: row.key, value: JSON.stringify(triage) }
    );

    overdue.push({
      from: triage.from,
      subject: triage.subject,
      daysSince: reminderDays,
      reminderNumber: triage.reminderCount
    });

    if (logger) logger.warn('followup_overdue', {
      from: triage.from,
      subject: triage.subject,
      reminderNumber: triage.reminderCount
    });
  }

  return { ok: true, reminders: overdue.length, overdue };
}

module.exports = { checkFollowupsTask };
