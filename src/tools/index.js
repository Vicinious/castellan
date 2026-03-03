'use strict';

const { ToolRegistry } = require('./registry');
const { execTool } = require('./core/shell');
const { readFileTool, writeFileTool, deleteFileTool } = require('./core/file');
const { webFetchTool, webSearchTool } = require('./core/web');
const { recallTool, rememberTool } = require('./core/memory');

function registerCoreTools(registry) {
  [execTool, readFileTool, writeFileTool, deleteFileTool, webFetchTool, webSearchTool, recallTool, rememberTool]
    .forEach((t) => registry.register(t));
}

module.exports = {
  ToolRegistry,
  registerCoreTools,
};
