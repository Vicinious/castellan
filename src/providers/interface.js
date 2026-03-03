'use strict';

class BaseProvider {
  constructor({ name, model, supportsStreaming = false, supportsTools = true, maxContextTokens = 32000 } = {}) {
    this.name = name;
    this.model = model;
    this.supportsStreaming = supportsStreaming;
    this.supportsTools = supportsTools;
    this.maxContextTokens = maxContextTokens;
  }

  estimateTokens(text = '') {
    return Math.ceil(String(text).length / 4);
  }

  async chat(_request) {
    throw new Error('Not implemented');
  }
}

module.exports = { BaseProvider };
