'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolvePath(p, ctx) {
  if (path.isAbsolute(p)) return p;
  return path.resolve(ctx?.workspace || process.cwd(), p);
}

const readFileTool = {
  name: 'read_file',
  description: 'Read file contents',
  category: 'file',
  riskLevel: 'LOW',
  timeoutMs: 5000,
  parameters: { required: ['path'], properties: { path: { type: 'string' }, encoding: { type: 'string' } } },
  async handler(args, ctx) {
    const p = resolvePath(args.path, ctx);
    const enc = args.encoding || 'utf8';
    return { path: p, content: fs.readFileSync(p, enc) };
  },
};

const writeFileTool = {
  name: 'write_file',
  description: 'Write file contents',
  category: 'file',
  riskLevel: 'MEDIUM',
  timeoutMs: 5000,
  parameters: { required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } },
  async handler(args, ctx) {
    const p = resolvePath(args.path, ctx);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, args.content);
    return { path: p, bytes: Buffer.byteLength(args.content) };
  },
};

const deleteFileTool = {
  name: 'delete_file',
  description: 'Delete file',
  category: 'file',
  riskLevel: 'HIGH',
  timeoutMs: 5000,
  parameters: { required: ['path'], properties: { path: { type: 'string' } } },
  async handler(args, ctx) {
    const p = resolvePath(args.path, ctx);
    fs.rmSync(p, { force: true });
    return { path: p, deleted: true };
  },
};

module.exports = { readFileTool, writeFileTool, deleteFileTool };
