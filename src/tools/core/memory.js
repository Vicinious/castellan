'use strict';

const rememberTool = {
  name: 'remember',
  description: 'Store fact in long-term memory',
  category: 'memory',
  riskLevel: 'LOW',
  timeoutMs: 5000,
  parameters: {
    required: ['subject', 'predicate', 'object'],
    properties: {
      subject: { type: 'string' }, predicate: { type: 'string' }, object: { type: 'string' }, category: { type: 'string' }, confidence: { type: 'number' }
    },
  },
  async handler(args, ctx) {
    if (!ctx?.memorySystem) return { stored: false, reason: 'memorySystem not present' };
    const id = ctx.memorySystem.storeFact({
      category: args.category || 'technical',
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      confidence: args.confidence ?? 0.8,
      source: 'tool:remember',
    });
    return { stored: true, id };
  },
};

const recallTool = {
  name: 'recall',
  description: 'Recall facts from long-term memory',
  category: 'memory',
  riskLevel: 'LOW',
  timeoutMs: 5000,
  parameters: { required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'number' }, category: { type: 'string' } } },
  async handler(args, ctx) {
    if (!ctx?.memorySystem) return { results: [], reason: 'memorySystem not present' };
    const results = ctx.memorySystem.recallFacts(args.query, { limit: args.limit || 10, category: args.category || null });
    return { results };
  },
};

module.exports = { rememberTool, recallTool };
