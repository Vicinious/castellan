'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fleetHealthCheck } = require('./tasks/health-check');
const { serviceHealTask } = require('./tasks/service-heal');
const { diskCleanupTask } = require('./tasks/disk-cleanup');

function loadConfig(configPath = path.join(__dirname, 'config', 'fleetguard.json')) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function createFleetGuard({ runtime, logger }) {
  const config = loadConfig();

  const execTool = async ({ command }) => {
    return runtime.toolRegistry.execute({ name: 'exec', args: { command } }, { workspace: runtime.config.workspace });
  };

  return {
    config,
    async runHealthCheck() {
      return fleetHealthCheck({ db: runtime.db, config, logger });
    },
    async runServiceHeal(service = 'nginx') {
      return serviceHealTask({ execTool, logger, service });
    },
    async runDiskCleanup() {
      return diskCleanupTask({ execTool, logger });
    },
    registerHeartbeatTasks() {
      runtime.heartbeat.scheduler.registerTask({
        name: 'fleet_health_check',
        intervalMs: config.heartbeat.tasks.fleet_health_check.intervalMs,
        enabled: config.heartbeat.tasks.fleet_health_check.enabled,
        priority: 0,
        timeoutMs: 30000,
        maxRetries: 1,
        handler: () => this.runHealthCheck(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'service_heal',
        intervalMs: config.heartbeat.tasks.service_heal.intervalMs,
        enabled: config.heartbeat.tasks.service_heal.enabled,
        priority: 1,
        timeoutMs: 30000,
        maxRetries: 1,
        handler: () => this.runServiceHeal('nginx'),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'disk_cleanup',
        intervalMs: config.heartbeat.tasks.disk_cleanup.intervalMs,
        enabled: config.heartbeat.tasks.disk_cleanup.enabled,
        priority: 2,
        timeoutMs: 60000,
        maxRetries: 1,
        handler: () => this.runDiskCleanup(),
      });
    }
  };
}

module.exports = { createFleetGuard, loadConfig };
