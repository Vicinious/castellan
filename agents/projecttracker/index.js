'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { primaryLoopTask } = require('./tasks/primary-loop');
const { maintenanceTask } = require('./tasks/maintenance');

function loadConfig(configPath = path.join(__dirname, 'config', 'projecttracker.json')) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function createProjecttracker({ runtime, logger }) {
  const config = loadConfig();
  return {
    config,
    runPrimaryLoop(meta = {}) {
      return primaryLoopTask({ db: runtime?.db, logger, taskName: 'primary_loop', summary: meta.summary || 'projecttracker primary loop ran' });
    },
    runMaintenance(meta = {}) {
      return maintenanceTask({ logger, scope: meta.scope || 'projecttracker' });
    },
    registerHeartbeatTasks() {
      runtime.heartbeat.scheduler.registerTask({
        name: 'projecttracker_primary_loop',
        intervalMs: config.heartbeat.tasks.primary_loop.intervalMs,
        enabled: config.heartbeat.tasks.primary_loop.enabled,
        priority: 1,
        timeoutMs: 30000,
        maxRetries: config.limits.maxRetries,
        handler: () => this.runPrimaryLoop(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'projecttracker_maintenance',
        intervalMs: config.heartbeat.tasks.maintenance.intervalMs,
        enabled: config.heartbeat.tasks.maintenance.enabled,
        priority: 2,
        timeoutMs: 30000,
        maxRetries: config.limits.maxRetries,
        handler: () => this.runMaintenance(),
      });
    }
  };
}

module.exports = { createProjecttracker, loadConfig };
