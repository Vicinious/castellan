'use strict';
const config=require('./config');
const {createLogger}=require('./logging/logger');
const {CastellanDB}=require('./db');
const {createAgentCore}=require('./agent');

function createRuntime(overrides={}){
  const runtimeConfig=overrides.config||config;
  const logger=overrides.logger||createLogger({level:runtimeConfig.logLevel,base:{service:'castellan'}});
  const db=overrides.db||new CastellanDB(runtimeConfig.dbPath);
  const agent=overrides.agent||createAgentCore({db,logger,config:runtimeConfig.agentCore||{}});

  return {
    config:runtimeConfig, logger, db, agent,
    async start(){
      db.migrate();
      db.initializeAgentState();
      logger.info('castellan runtime started',{env:runtimeConfig.env,dbPath:runtimeConfig.dbPath,agentId:runtimeConfig.agent.id});
    },
    async runTurn(input, opts={}) { return agent.run(input, opts); },
    async stop(){ db.close(); logger.info('castellan runtime stopped'); }
  };
}

if(require.main===module){
  const runtime=createRuntime();
  runtime.start()
    .then(()=>runtime.runTurn('Castellan self-check ping', { inputSource:'manual_trigger', sessionId:'bootstrap' }))
    .then((res)=>runtime.logger.info('sample_turn_complete',{text:res.text,toolCalls:res.toolCalls.length}))
    .catch((err)=>{console.error(err); process.exit(1);});
}

module.exports={createRuntime};
