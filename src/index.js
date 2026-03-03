'use strict';
const config=require('./config');
const {createLogger}=require('./logging/logger');
const {CastellanDB}=require('./db');
function createRuntime(overrides={}){ const runtimeConfig=overrides.config||config; const logger=overrides.logger||createLogger({level:runtimeConfig.logLevel,base:{service:'castellan'}}); const db=overrides.db||new CastellanDB(runtimeConfig.dbPath);
return {config:runtimeConfig,logger,db,async start(){db.migrate(); db.initializeAgentState(); logger.info('castellan foundation started',{env:runtimeConfig.env,dbPath:runtimeConfig.dbPath,agentId:runtimeConfig.agent.id});}, async stop(){db.close(); logger.info('castellan foundation stopped');}}; }
if(require.main===module){ const runtime=createRuntime(); runtime.start().catch((err)=>{console.error(err); process.exit(1);}); }
module.exports={createRuntime};
