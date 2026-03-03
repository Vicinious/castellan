'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { checkProjectsTask } = require('./tasks/check-projects');
const { checkDeadlinesTask } = require('./tasks/check-deadlines');
const { weeklyDigestTask } = require('./tasks/weekly-digest');

function loadConfig(configPath = path.join(__dirname, 'config', 'project-tracker.json')) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function createProjectTracker({ runtime, logger }) {
  const config = loadConfig();

  const execTool = async ({ command }) => {
    return runtime.toolRegistry.execute(
      { name: 'exec', args: { command } },
      { workspace: runtime.config.workspace }
    );
  };

  const readFileTool = async ({ path: filePath }) => {
    return runtime.toolRegistry.execute(
      { name: 'read_file', args: { path: filePath } },
      { workspace: runtime.config.workspace }
    );
  };

  const llmTool = async ({ prompt, maxTokens = 1500 }) => {
    return runtime.providerRouter.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens
    });
  };

  return {
    config,

    async runCheckProjects() {
      return checkProjectsTask({
        db: runtime.db,
        config,
        logger,
        execTool,
        readFileTool
      });
    },

    async runCheckDeadlines() {
      return checkDeadlinesTask({
        db: runtime.db,
        config,
        logger
      });
    },

    async runWeeklyDigest() {
      return weeklyDigestTask({
        db: runtime.db,
        config,
        logger,
        llmTool
      });
    },

    registerHeartbeatTasks() {
      runtime.heartbeat.scheduler.registerTask({
        name: 'check_projects',
        intervalMs: config.heartbeat.tasks.check_projects.intervalMs,
        enabled: config.heartbeat.tasks.check_projects.enabled,
        priority: 0,
        timeoutMs: 120000,
        maxRetries: 1,
        handler: () => this.runCheckProjects(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'check_deadlines',
        intervalMs: config.heartbeat.tasks.check_deadlines.intervalMs,
        enabled: config.heartbeat.tasks.check_deadlines.enabled,
        priority: 1,
        timeoutMs: 30000,
        maxRetries: 1,
        handler: () => this.runCheckDeadlines(),
      });

      // Weekly digest uses cron expression
      runtime.heartbeat.scheduler.registerTask({
        name: 'weekly_digest',
        cronExpression: config.heartbeat.tasks.weekly_digest.cronExpression,
        enabled: config.heartbeat.tasks.weekly_digest.enabled,
        priority: 2,
        timeoutMs: 180000,
        maxRetries: 1,
        handler: () => this.runWeeklyDigest(),
      });
    }
  };
}

module.exports = { createProjectTracker, loadConfig };
