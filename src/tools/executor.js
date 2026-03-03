'use strict';

async function withTimeout(promise, ms, name) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tool timeout: ${name}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function executeToolCall({ registry, policy, call, context = {}, logger }) {
  const tool = registry.get(call.name);
  if (!tool) throw new Error(`Unknown tool: ${call.name}`);

  const policyDecision = policy.evaluate({ toolName: call.name, args: call.args || {}, context });
  if (policyDecision.action === 'deny') throw new Error(`Policy denied: ${policyDecision.reason}`);
  if (policyDecision.action === 'escalate') throw new Error(`Policy escalation required: ${policyDecision.reason}`);
  if (policyDecision.action === 'quarantine') throw new Error(`Policy quarantined call: ${policyDecision.reason}`);

  if (logger) logger.info('tool_execute_start', { tool: call.name });
  const result = await withTimeout(Promise.resolve(tool.handler(call.args || {}, context)), tool.timeoutMs || 30_000, call.name);
  if (logger) logger.info('tool_execute_done', { tool: call.name });
  return result;
}

module.exports = { executeToolCall };
