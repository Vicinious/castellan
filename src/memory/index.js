'use strict';

const { WorkingMemory } = require('./working');
const { LongTermMemory } = require('./long-term');
const { ProceduralMemory } = require('./procedural');
const { buildBudgetedContext } = require('./retrieval');
const { consolidateMemory } = require('./consolidation');

class MemorySystem {
  constructor({ db, workingMemoryLimit = 200, tokenBudgets = { working: 8000, longTerm: 4000, procedural: 2000 } } = {}) {
    this.db = db;
    this.tokenBudgets = tokenBudgets;
    this.working = new WorkingMemory({ db, maxEntries: workingMemoryLimit });
    this.longTerm = new LongTermMemory({ db });
    this.procedural = new ProceduralMemory({ db });
  }

  addToWorking(entry, sessionId) { return this.working.add(entry, sessionId); }
  getWorkingContext(sessionId, budget = this.tokenBudgets.working) { return this.working.getContext(sessionId, budget); }
  clearWorking(sessionId) { return this.working.clear(sessionId); }

  storeFact(fact) { return this.longTerm.storeFact(fact); }
  recallFacts(query, opts) { return this.longTerm.recallFacts(query, opts); }
  updateFact(id, updates) { return this.longTerm.updateFact(id, updates); }

  storeProcedure(proc) { return this.procedural.storeProcedure(proc); }
  recallProcedures(task, opts) { return this.procedural.recallProcedures(task, opts); }

  async consolidate(opts = {}) { return consolidateMemory({ db: this.db, ...opts }); }

  buildContextPack({ sessionId = 'default', factQuery = '', procedureTask = '' } = {}) {
    const workingCtx = this.getWorkingContext(sessionId, this.tokenBudgets.working);
    const facts = factQuery ? this.recallFacts(factQuery, { limit: 25 }) : [];
    const procedures = procedureTask ? this.recallProcedures(procedureTask, { limit: 10 }) : [];
    return buildBudgetedContext({
      working: workingCtx.entries,
      longTerm: facts,
      procedures,
      budgets: this.tokenBudgets,
    });
  }
}

module.exports = {
  MemorySystem,
  WorkingMemory,
  LongTermMemory,
  ProceduralMemory,
};
