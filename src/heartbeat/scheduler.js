'use strict';

function nowIso() {
  return new Date().toISOString();
}

class DurableScheduler {
  constructor({ db, logger, leaseTimeoutMs = 5 * 60 * 1000, maxConcurrentTasks = 3 } = {}) {
    this.db = db;
    this.logger = logger;
    this.leaseTimeoutMs = leaseTimeoutMs;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.running = new Map();
    this.handlers = new Map();
  }

  registerTask(def) {
    if (!def?.name || typeof def?.handler !== 'function') throw new Error('Invalid task definition');
    this.handlers.set(def.name, def.handler);
    this.db.run(
      `INSERT INTO heartbeat_schedule (task_name, cron_expression, interval_ms, enabled, priority, timeout_ms, max_retries, next_run_at, created_at, updated_at)
       VALUES (:name,:cron,:interval,:enabled,:priority,:timeout,:retries,datetime('now'),datetime('now'),datetime('now'))
       ON CONFLICT(task_name) DO UPDATE SET
         cron_expression=excluded.cron_expression,
         interval_ms=excluded.interval_ms,
         enabled=excluded.enabled,
         priority=excluded.priority,
         timeout_ms=excluded.timeout_ms,
         max_retries=excluded.max_retries,
         updated_at=datetime('now')`,
      {
        name: def.name,
        cron: def.cronExpression || null,
        interval: def.intervalMs || null,
        enabled: def.enabled === false ? 0 : 1,
        priority: def.priority ?? 0,
        timeout: def.timeoutMs ?? 30000,
        retries: def.maxRetries ?? 1,
      }
    );
  }

  unregisterTask(taskName) {
    this.handlers.delete(taskName);
    this.db.run(`DELETE FROM heartbeat_schedule WHERE task_name=:name`, { name: taskName });
  }

  _dueTasks() {
    return this.db.all(
      `SELECT * FROM heartbeat_schedule
       WHERE enabled=1
         AND (lease_owner IS NULL OR datetime(lease_expires_at) < datetime('now'))
         AND (next_run_at IS NULL OR datetime(next_run_at) <= datetime('now'))
       ORDER BY priority ASC, datetime(next_run_at) ASC
       LIMIT :n`,
      { n: this.maxConcurrentTasks }
    );
  }

  _acquireLease(taskName) {
    const owner = `sched-${process.pid}`;
    const exp = new Date(Date.now() + this.leaseTimeoutMs).toISOString();
    this.db.run(
      `UPDATE heartbeat_schedule
       SET lease_owner=:owner, lease_expires_at=:exp, updated_at=datetime('now')
       WHERE task_name=:name`,
      { owner, exp, name: taskName }
    );
  }

  _releaseLease(taskName) {
    this.db.run(
      `UPDATE heartbeat_schedule
       SET lease_owner=NULL, lease_expires_at=NULL, updated_at=datetime('now')
       WHERE task_name=:name`,
      { name: taskName }
    );
  }

  _scheduleNext(task) {
    if (!task.interval_ms) {
      this.db.run(`UPDATE heartbeat_schedule SET next_run_at=datetime('now','+5 minutes'), updated_at=datetime('now') WHERE task_name=:name`, { name: task.task_name });
      return;
    }
    const next = new Date(Date.now() + Number(task.interval_ms)).toISOString();
    this.db.run(`UPDATE heartbeat_schedule SET next_run_at=:next, updated_at=datetime('now') WHERE task_name=:name`, { name: task.task_name, next });
  }

  async forceRun(taskName, context = {}) {
    const handler = this.handlers.get(taskName);
    if (!handler) throw new Error(`Task not registered: ${taskName}`);
    return this._runTask({ task_name: taskName, interval_ms: null, max_retries: 0 }, handler, context);
  }

  async tick(context = {}) {
    const due = this._dueTasks();
    const out = [];
    for (const task of due) {
      const handler = this.handlers.get(task.task_name);
      if (!handler) continue;
      out.push(await this._runTask(task, handler, context));
    }
    return out;
  }

  async _runTask(task, handler, context) {
    const taskName = task.task_name;
    const started = Date.now();
    this._acquireLease(taskName);
    this.running.set(taskName, started);
    let result = null;
    let err = null;

    try {
      result = await handler(context);
      this.db.run(
        `UPDATE heartbeat_schedule
         SET last_run_at=datetime('now'), run_count=run_count+1, last_result=:res, last_error=NULL, updated_at=datetime('now')
         WHERE task_name=:name`,
        { name: taskName, res: JSON.stringify(result || {}) }
      );
      this._scheduleNext(task);
      if (this.logger) this.logger.info('heartbeat_task_ok', { task: taskName, ms: Date.now() - started });
      return { task: taskName, ok: true, result };
    } catch (e) {
      err = e;
      this.db.run(
        `UPDATE heartbeat_schedule
         SET last_run_at=datetime('now'), fail_count=fail_count+1, last_error=:err, updated_at=datetime('now')
         WHERE task_name=:name`,
        { name: taskName, err: e.message || String(e) }
      );
      this._scheduleNext(task);
      if (this.logger) this.logger.error('heartbeat_task_err', { task: taskName, error: e.message || String(e) });
      return { task: taskName, ok: false, error: e.message || String(e) };
    } finally {
      this.running.delete(taskName);
      this._releaseLease(taskName);
    }
  }

  getSchedule() {
    return this.db.all(`SELECT * FROM heartbeat_schedule ORDER BY priority ASC, task_name ASC`);
  }

  getRunningTasks() {
    return [...this.running.keys()];
  }
}

module.exports = { DurableScheduler, nowIso };
