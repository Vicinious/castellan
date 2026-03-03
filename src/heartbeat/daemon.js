'use strict';

const { DurableScheduler } = require('./scheduler');
const { createWakeEvent } = require('./wake');
const { healthCheckTask } = require('./tasks/health');
const { memoryConsolidationTask } = require('./tasks/consolidation');
const { metricSnapshotTask } = require('./tasks/metrics');
const { staleCleanupTask } = require('./tasks/cleanup');

class HeartbeatDaemon {
  constructor({ db, logger, memorySystem, tickIntervalMs = 60_000 } = {}) {
    this.db = db;
    this.logger = logger;
    this.memorySystem = memorySystem;
    this.tickIntervalMs = tickIntervalMs;
    this.timer = null;
    this.scheduler = new DurableScheduler({ db, logger });
  }

  _registerBuiltins() {
    this.scheduler.registerTask({
      name: 'health_check',
      description: 'Verify agent health',
      intervalMs: 5 * 60_000,
      timeoutMs: 15_000,
      maxRetries: 1,
      priority: 0,
      handler: (ctx) => healthCheckTask({ ...ctx, db: this.db }),
    });

    this.scheduler.registerTask({
      name: 'memory_consolidation',
      description: 'Compress working memory',
      intervalMs: 60 * 60_000,
      timeoutMs: 30_000,
      maxRetries: 1,
      priority: 1,
      handler: (ctx) => memoryConsolidationTask({ ...ctx, memorySystem: this.memorySystem }),
    });

    this.scheduler.registerTask({
      name: 'metric_snapshot',
      description: 'Snapshot metrics',
      intervalMs: 15 * 60_000,
      timeoutMs: 15_000,
      maxRetries: 1,
      priority: 1,
      handler: (ctx) => metricSnapshotTask({ ...ctx, db: this.db }),
    });

    this.scheduler.registerTask({
      name: 'stale_cleanup',
      description: 'Remove stale memory entries',
      intervalMs: 24 * 60 * 60_000,
      timeoutMs: 15_000,
      maxRetries: 1,
      priority: 2,
      handler: (ctx) => staleCleanupTask({ ...ctx, db: this.db }),
    });
  }

  async tick() {
    const runs = await this.scheduler.tick({ db: this.db, memorySystem: this.memorySystem });
    for (const r of runs) {
      if (!r.ok) continue;
      if (r.task === 'health_check' || r.task === 'memory_consolidation') {
        createWakeEvent(this.db, 'scheduled_task', { task: r.task, result: r.result || null });
      }
    }
    return runs;
  }

  start() {
    if (this.timer) return;
    this._registerBuiltins();
    this.timer = setInterval(() => {
      this.tick().catch((err) => this.logger?.error('heartbeat_tick_failed', { error: err.message || String(err) }));
    }, this.tickIntervalMs);
    this.logger?.info('heartbeat_started', { tickIntervalMs: this.tickIntervalMs });
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.logger?.info('heartbeat_stopped');
  }

  isRunning() {
    return Boolean(this.timer);
  }
}

module.exports = { HeartbeatDaemon };
