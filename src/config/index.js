'use strict';
const path=require('node:path');
const rootDir = path.resolve(__dirname, '..', '..');
const dataDir = process.env.CASTELLAN_DATA_DIR || path.join(rootDir, 'data');
const dbPath = process.env.CASTELLAN_DB_PATH || path.join(dataDir, 'castellan.db');
module.exports = {
  env: process.env.NODE_ENV || 'development',
  rootDir,
  dataDir,
  dbPath,
  logLevel: process.env.CASTELLAN_LOG_LEVEL || 'info',
  defaultProvider: process.env.CASTELLAN_DEFAULT_PROVIDER || 'anthropic',
  heartbeatTickMs: Number(process.env.CASTELLAN_HEARTBEAT_TICK_MS || 60000),
  workspace: process.env.CASTELLAN_WORKSPACE || process.cwd(),
};
