'use strict';
const path = require('node:path');
function intEnv(name, def) { const v=process.env[name]; if(v==null||v==='') return def; const n=Number.parseInt(v,10); if(Number.isNaN(n)) throw new Error(`Invalid integer env ${name}: ${v}`); return n; }
const rootDir = path.resolve(__dirname, '..', '..');
const dataDir = process.env.CASTELLAN_DATA_DIR || path.join(rootDir, 'data');
const dbPath = process.env.CASTELLAN_DB_PATH || path.join(dataDir, 'castellan.db');
module.exports = {
  env: process.env.NODE_ENV || 'development',
  rootDir,
  dataDir,
  dbPath,
  dbBusyTimeoutMs: intEnv('CASTELLAN_DB_BUSY_TIMEOUT_MS', 5000),
  logLevel: process.env.CASTELLAN_LOG_LEVEL || 'info',
  agent: { id: process.env.CASTELLAN_AGENT_ID || 'castellan-main', name: process.env.CASTELLAN_AGENT_NAME || 'Castellan' }
};
