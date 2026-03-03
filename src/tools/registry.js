'use strict';

const { validateArgs } = require('./validator');
const { executeToolCall } = require('./executor');

class ToolRegistry {
  constructor({ policy, logger } = {}) {
    this.policy = policy;
    this.logger = logger;
    this.tools = new Map();
  }

  register(tool) {
    if (!tool?.name || typeof tool?.handler !== 'function') throw new Error('Invalid tool registration');
    this.tools.set(tool.name, tool);
  }

  unregister(name) { this.tools.delete(name); }
  get(name) { return this.tools.get(name); }
  list() { return [...this.tools.values()].map((t) => ({ name: t.name, category: t.category, riskLevel: t.riskLevel })); }
  listByCategory(category) { return this.list().filter((t) => t.category === category); }

  async execute(call, context = {}) {
    const tool = this.get(call.name);
    if (!tool) throw new Error(`Unknown tool: ${call.name}`);
    const val = validateArgs(tool.parameters || {}, call.args || {});
    if (!val.ok) throw new Error(`Validation failed: ${val.error}`);

    return executeToolCall({ registry: this, policy: this.policy, call, context, logger: this.logger });
  }
}

module.exports = { ToolRegistry };
