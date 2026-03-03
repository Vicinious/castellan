'use strict';
const {CastellanDB}=require('./index');
const db=new CastellanDB();
db.migrate(); db.initializeAgentState();
console.log(`Castellan DB migrated at ${db.dbPath}`); db.close();
