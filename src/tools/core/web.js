'use strict';

const webFetchTool = {
  name: 'web_fetch',
  description: 'Fetch URL content',
  category: 'web',
  riskLevel: 'MEDIUM',
  timeoutMs: 15000,
  parameters: { required: ['url'], properties: { url: { type: 'string' } } },
  async handler(args) {
    const res = await fetch(args.url);
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 4000) };
  },
};

const webSearchTool = {
  name: 'web_search',
  description: 'Simple placeholder web search',
  category: 'web',
  riskLevel: 'LOW',
  timeoutMs: 5000,
  parameters: { required: ['query'], properties: { query: { type: 'string' } } },
  async handler(args) {
    return { query: args.query, results: [] };
  },
};

module.exports = { webFetchTool, webSearchTool };
