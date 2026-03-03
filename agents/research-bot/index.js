'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { newsScanTask } = require('./tasks/news-scan');
const { competitorCheckTask } = require('./tasks/competitor-check');
const { knowledgeSynthesisTask } = require('./tasks/knowledge-synthesis');

function loadConfig(configPath = path.join(__dirname, 'config', 'research-bot.json')) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function createResearchBot({ runtime, logger }) {
  const config = loadConfig();

  const webSearchTool = async ({ query, count = 5 }) => {
    return runtime.toolRegistry.execute(
      { name: 'web_search', args: { query, count } },
      { workspace: runtime.config.workspace }
    );
  };

  const webFetchTool = async ({ url }) => {
    return runtime.toolRegistry.execute(
      { name: 'web_fetch', args: { url } },
      { workspace: runtime.config.workspace }
    );
  };

  const writeFileTool = async ({ path: filePath, content }) => {
    return runtime.toolRegistry.execute(
      { name: 'write_file', args: { path: filePath, content } },
      { workspace: runtime.config.workspace }
    );
  };

  const llmTool = async ({ prompt, maxTokens = 2000 }) => {
    return runtime.providerRouter.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens
    });
  };

  return {
    config,

    async runNewsScan() {
      return newsScanTask({
        db: runtime.db,
        config,
        logger,
        webSearchTool,
        llmTool
      });
    },

    async runCompetitorCheck() {
      return competitorCheckTask({
        db: runtime.db,
        config,
        logger,
        webSearchTool,
        webFetchTool,
        llmTool
      });
    },

    async runKnowledgeSynthesis() {
      return knowledgeSynthesisTask({
        db: runtime.db,
        config,
        logger,
        llmTool,
        writeFileTool
      });
    },

    registerHeartbeatTasks() {
      runtime.heartbeat.scheduler.registerTask({
        name: 'news_scan',
        intervalMs: config.heartbeat.tasks.news_scan.intervalMs,
        enabled: config.heartbeat.tasks.news_scan.enabled,
        priority: 0,
        timeoutMs: 180000,
        maxRetries: 1,
        handler: () => this.runNewsScan(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'competitor_check',
        intervalMs: config.heartbeat.tasks.competitor_check.intervalMs,
        enabled: config.heartbeat.tasks.competitor_check.enabled,
        priority: 1,
        timeoutMs: 300000,
        maxRetries: 1,
        handler: () => this.runCompetitorCheck(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'knowledge_synthesis',
        intervalMs: config.heartbeat.tasks.knowledge_synthesis.intervalMs,
        enabled: config.heartbeat.tasks.knowledge_synthesis.enabled,
        priority: 2,
        timeoutMs: 300000,
        maxRetries: 1,
        handler: () => this.runKnowledgeSynthesis(),
      });
    }
  };
}

module.exports = { createResearchBot, loadConfig };
