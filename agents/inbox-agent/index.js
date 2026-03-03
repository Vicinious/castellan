'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { checkInboxTask } = require('./tasks/check-inbox');
const { draftRepliesTask } = require('./tasks/draft-replies');
const { checkFollowupsTask } = require('./tasks/check-followups');

function loadConfig(configPath = path.join(__dirname, 'config', 'inbox-agent.json')) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function createInboxAgent({ runtime, logger }) {
  const config = loadConfig();

  const gmailTool = async (action, params = {}) => {
    // Use gog CLI for Gmail operations
    return runtime.toolRegistry.execute(
      { name: 'exec', args: { 
        command: `gog gmail ${action} ${Object.entries(params).map(([k,v]) => `--${k}="${v}"`).join(' ')} --json`
      }},
      { workspace: runtime.config.workspace }
    );
  };

  const llmTool = async ({ prompt, maxTokens = 1000 }) => {
    return runtime.providerRouter.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens
    });
  };

  return {
    config,

    async runCheckInbox() {
      return checkInboxTask({
        db: runtime.db,
        config,
        logger,
        gmailTool,
        llmTool
      });
    },

    async runDraftReplies() {
      return draftRepliesTask({
        db: runtime.db,
        config,
        logger,
        gmailTool,
        llmTool
      });
    },

    async runCheckFollowups() {
      return checkFollowupsTask({
        db: runtime.db,
        config,
        logger
      });
    },

    registerHeartbeatTasks() {
      runtime.heartbeat.scheduler.registerTask({
        name: 'check_inbox',
        intervalMs: config.heartbeat.tasks.check_inbox.intervalMs,
        enabled: config.heartbeat.tasks.check_inbox.enabled,
        priority: 0,
        timeoutMs: 60000,
        maxRetries: 2,
        handler: () => this.runCheckInbox(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'draft_replies',
        intervalMs: config.heartbeat.tasks.draft_replies.intervalMs,
        enabled: config.heartbeat.tasks.draft_replies.enabled,
        priority: 1,
        timeoutMs: 120000,
        maxRetries: 1,
        handler: () => this.runDraftReplies(),
      });

      runtime.heartbeat.scheduler.registerTask({
        name: 'check_followups',
        intervalMs: config.heartbeat.tasks.check_followups.intervalMs,
        enabled: config.heartbeat.tasks.check_followups.enabled,
        priority: 2,
        timeoutMs: 30000,
        maxRetries: 1,
        handler: () => this.runCheckFollowups(),
      });
    }
  };
}

module.exports = { createInboxAgent, loadConfig };
