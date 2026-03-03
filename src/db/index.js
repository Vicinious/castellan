'use strict';
const fs=require('node:fs'); const path=require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config=require('../config');

class CastellanDB {
  constructor(dbPath=config.dbPath){ this.dbPath=dbPath; this.db=null; }
  open(){ if(this.db) return this.db; fs.mkdirSync(path.dirname(this.dbPath),{recursive:true}); this.db=new DatabaseSync(this.dbPath); this.db.exec('PRAGMA busy_timeout=5000;'); return this.db; }
  run(sql,params={}){ return this.open().prepare(sql).run(params); }
  get(sql,params={}){ return this.open().prepare(sql).get(params); }
  all(sql,params={}){ return this.open().prepare(sql).all(params); }
  close(){ if(this.db){ this.db.close(); this.db=null; } }
  migrateFrom(filePath){ const sql=fs.readFileSync(filePath,'utf8'); this.open().exec(sql); }
}
module.exports={CastellanDB};
