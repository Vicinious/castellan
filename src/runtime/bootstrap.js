'use strict';

const path = require('node:path');
const config = require('../config');
const { createLogger } = require('../logging/logger');
const { CastellanDB } = require('../db');
const { MemorySystem } = require('../memory');
const { createDefaultPolicy } = require('../policy');
const { ToolRegistry, registerCoreTools } = require('../tools');
const { createDefaultRouter } = require('../providers');
const { createAgentCore } = require('../agent');
const { HeartbeatDaemon } = require('../heartbeat');

function migrate(db, logger) {
  const migrationFile = process.env.CASTELLAN_SCHEMA_FILE || '/home/openclaw/.openclaw/workspace/projects/castellan/src/db/migrations/001_initial.sql';
  db.migrateFrom(migrationFile);
  logger.info('db_migrated', { migrationFile });
}

function createRuntime(overrides = {}) {
  const runtimeConfig = { ...config, ...(overrides.config || {}) };
  const logger = overrides.logger || createLogger({ level: runtimeConfig.logLevel, base: { service: 'castellan' } });
  const db = overrides.db || new CastellanDB(runtimeConfig.dbPath);

  migrate(db, logger);

  const memorySystem = new MemorySystem({ db });
  const policy = createDefaultPolicy({ workspace: runtimeConfig.workspace });
  const toolRegistry = new ToolRegistry({ policy, logger });
  registerCoreTools(toolRegistry);

  const providerRouter = createDefaultRouter();
  const provider = {
    name: 'router',
    model: runtimeConfig.defaultProvider,
    chat: (request) => providerRouter.chatWithFallback(request),
  };

  const agent = createAgentCore({
    db,
    logger,
    provider,
    config: {
      maxToolCallsPerTurn: 10,
      maxConsecutiveErrors: 5,
      maxRepetitiveTurns: 3,
      turnTimeoutMs: 120000,
      toolExecutor: (tc) => toolRegistry.execute({ name: tc.name, args: tc.arguments || tc.args || {} }, { workspace: runtimeConfig.workspace, memorySystem }),
    },
  });

  const heartbeat = new HeartbeatDaemon({
    db,
    logger,
    memorySystem,
    tickIntervalMs: runtimeConfig.heartbeatTickMs,
  });

  return {
    config: runtimeConfig,
    logger,
    db,
    memorySystem,
    policy,
    toolRegistry,
    providerRouter,
    agent,
    heartbeat,
    async start() {
      heartbeat.start();
      logger.info('runtime_started', { dbPath: runtimeConfig.dbPath, provider: runtimeConfig.defaultProvider });
    },
    async stop() {
      heartbeat.stop();
      db.close();
      logger.info('runtime_stopped');
    },
    async runTurn(input, opts = {}) {
      return agent.run(input, { sessionId: opts.sessionId || 'default', inputSource: opts.inputSource || 'user' });
    }
  };
}

module.exports = { createRuntime };
