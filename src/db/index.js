'use strict';
const fs=require('node:fs'); const path=require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config=require('../config');
class CastellanDB { constructor(dbPath=config.dbPath){ this.dbPath=dbPath; this.db=null; }
open(){ if(this.db) return this.db; fs.mkdirSync(path.dirname(this.dbPath),{recursive:true}); this.db=new DatabaseSync(this.dbPath); this.db.exec(`PRAGMA busy_timeout=${config.dbBusyTimeoutMs};`); return this.db; }
migrate(){ const sql=fs.readFileSync(path.join(__dirname,'migrations','001_initial.sql'),'utf8'); this.open().exec(sql); }
initializeAgentState(){ this.run(`UPDATE agent_state SET agent_id=:agentId, agent_name=:agentName, config_json=:cfg, updated_at=datetime('now') WHERE id=1`,{agentId:config.agent.id,agentName:config.agent.name,cfg:JSON.stringify(config)}); }
run(sql,params={}){ return this.open().prepare(sql).run(params);} get(sql,params={}){return this.open().prepare(sql).get(params);} all(sql,params={}){return this.open().prepare(sql).all(params);} close(){ if(this.db){this.db.close(); this.db=null;}}
}
module.exports={CastellanDB};
