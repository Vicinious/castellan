'use strict';
const levels=['debug','info','warn','error'];
function createLogger({level='info',base={}}={}){ const m=levels.indexOf(level); const w=(l,msg,meta={})=>{ if(levels.indexOf(l)<m) return; process.stdout.write(JSON.stringify({ts:new Date().toISOString(),level:l,message:msg,...base,...meta})+'\n');}; return {debug:(m,meta)=>w('debug',m,meta),info:(m,meta)=>w('info',m,meta),warn:(m,meta)=>w('warn',m,meta),error:(m,meta)=>w('error',m,meta)}; }
module.exports={createLogger};
