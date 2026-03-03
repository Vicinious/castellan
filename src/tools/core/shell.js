'use strict';

const { exec: cpExec } = require('node:child_process');

const execTool = {
  name: 'exec',
  description: 'Execute shell command',
  category: 'shell',
  riskLevel: 'MEDIUM',
  timeoutMs: 30000,
  parameters: {
    required: ['command'],
    properties: { command: { type: 'string' }, cwd: { type: 'string' }, timeout: { type: 'number' } },
  },
  handler(args, ctx) {
    return new Promise((resolve, reject) => {
      cpExec(args.command, { cwd: args.cwd || ctx?.workspace || process.cwd(), timeout: args.timeout || 30000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve({ stdout, stderr });
      });
    });
  },
};

module.exports = { execTool };
