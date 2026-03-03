'use strict';

async function checkDeadlinesTask({ db, config, logger }) {
  if (!db) {
    return { ok: false, error: 'no_db' };
  }

  const warnDays = config.thresholds?.deadlineWarnDays || 3;
  
  // Get all deadlines from kv_store
  const rows = db.all(
    `SELECT key, value FROM kv_store 
     WHERE namespace = 'project_deadlines'
     AND json_extract(value, '$.completed') IS NULL`
  );

  if (rows.length === 0) {
    if (logger) logger.info('deadlines_none');
    return { ok: true, upcoming: 0, overdue: 0 };
  }

  const now = new Date();
  const upcoming = [];
  const overdue = [];

  for (const row of rows) {
    const deadline = JSON.parse(row.value);
    const dueDate = new Date(deadline.dueDate);
    const daysUntil = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      overdue.push({
        ...deadline,
        daysOverdue: Math.abs(daysUntil)
      });
      
      if (logger) logger.error('deadline_overdue', {
        project: deadline.project,
        task: deadline.task,
        daysOverdue: Math.abs(daysUntil)
      });
    } else if (daysUntil <= warnDays) {
      upcoming.push({
        ...deadline,
        daysUntil
      });

      if (logger) logger.warn('deadline_approaching', {
        project: deadline.project,
        task: deadline.task,
        daysUntil
      });
    }
  }

  return { 
    ok: true, 
    upcoming: upcoming.length, 
    overdue: overdue.length,
    upcomingItems: upcoming,
    overdueItems: overdue
  };
}

module.exports = { checkDeadlinesTask };
