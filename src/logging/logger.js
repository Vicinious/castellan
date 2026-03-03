'use strict';
const levels=['debug','info','warn','error'];
function createLogger({level='info',base={}}={}){ const min=levels.indexOf(level); function w(l,m,meta={}){ if(levels.indexOf(l)<min) return; process.stdout.write(JSON.stringify({ts:new Date().toISOString(),level:l,message:m,...base,...meta})+'\n'); }
return {debug:(m,meta)=>w('debug',m,meta),info:(m,meta)=>w('info',m,meta),warn:(m,meta)=>w('warn',m,meta),error:(m,meta)=>w('error',m,meta)}; }
module.exports={createLogger};
