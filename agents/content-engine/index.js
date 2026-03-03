'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { contentIdeationTask } = require('./tasks/ideation');
const { draftGenerationTask } = require('./tasks/draft-generation');
const { publishScheduledTask } = require('./tasks/publish');

function loadConfig(configPath = path.join(__dirname, 'config', 'content-engine.json')) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function createContentEngine({ runtime, logger }) {
  const config = loadConfig();

  const llmTool = async ({ prompt, maxTokens = 2000 }) => {
    return runtime.providerRouter.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens
    });
  };

  const webSearchTool = async ({ query }) => {
    return runtime.toolRegistry.execute(
      { name: 'web_search', args: { query } },
      { workspace: runtime.config.workspace }
    );
  };

  const writeFileTool = async ({ path: filePath, content }) => {
    return runtime.toolRegistry.execute(
      { name: 'write_file', args: { path: filePath, content } },
      { workspace: runtime.config.workspace }
    );
  };

  return {
    config,

    async runIdeation() {
      return contentIdeationTask({
        db: runtime.db,
        config,
        logger,
        webSearchTool,
        llmTool
      });
    },

    async runDraftGeneration(topic = null) {
      return draftGenerationTask({
        db: runtime.db,
        config,
        logger,
        llmTool,
        writeFileTool,
        topic
      });
    },

    async runPublishScheduled() {
      return publishScheduledTask({
        db: runtime.db,
        config,
        logger
      });
    },

    registerHeartbeatTasks() {
      runtime.heartbeat.scheduler.registerTask({
        name: 'content_ideation',
        intervalMs: config.heartbeat.tasks.content_ideation.intervalMs,
        enabled: config.heartbeat.tasks.content_ideation.enabled,
        priority: 0,
        timeoutMs: 120000,
        maxRetries: 1,
        handler: () => this.runIdeation(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'draft_generation',
        intervalMs: config.heartbeat.tasks.draft_generation.intervalMs,
        enabled: config.heartbeat.tasks.draft_generation.enabled,
        priority: 1,
        timeoutMs: 300000,
        maxRetries: 1,
        handler: () => this.runDraftGeneration(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'publish_scheduled',
        intervalMs: config.heartbeat.tasks.publish_scheduled.intervalMs,
        enabled: config.heartbeat.tasks.publish_scheduled.enabled,
        priority: 2,
        timeoutMs: 60000,
        maxRetries: 1,
        handler: () => this.runPublishScheduled(),
      });
    }
  };
}

module.exports = { createContentEngine, loadConfig };
