'use strict';

class ProviderRouter {
  constructor({ providers = {}, defaultProvider = 'ollama', routingRules = [], fallbackChain = [] } = {}) {
    this.providers = providers;
    this.defaultProvider = defaultProvider;
    this.routingRules = routingRules;
    this.fallbackChain = fallbackChain;
  }

  route(request = {}) {
    const taskType = request.taskType || 'default';
    for (const rule of this.routingRules) {
      if (rule?.match?.taskType && rule.match.taskType === taskType) {
        const p = this.providers[rule.provider];
        if (p) return { provider: p, model: rule.model || p.model, reason: rule.reason || 'rule_match' };
      }
    }
    const p = this.providers[this.defaultProvider];
    if (!p) throw new Error(`Default provider not registered: ${this.defaultProvider}`);
    return { provider: p, model: p.model, reason: 'default' };
  }

  async chat(request = {}) {
    const picked = this.route(request);
    return picked.provider.chat({ ...request, model: request.model || picked.model });
  }

  async chatWithFallback(request = {}) {
    const tried = [];

    // try routed/default first
    try {
      const primary = this.route(request);
      tried.push(primary.provider.name);
      return await primary.provider.chat({ ...request, model: request.model || primary.model });
    } catch (err) {
      var lastErr = err;
    }

    // then fallback chain
    for (const name of this.fallbackChain) {
      if (tried.includes(name)) continue;
      const p = this.providers[name];
      if (!p) continue;
      try {
        tried.push(name);
        return await p.chat({ ...request, model: request.model || p.model });
      } catch (err) {
        lastErr = err;
      }
    }

    throw new Error(`All providers failed: ${tried.join(', ')} :: ${lastErr?.message || 'unknown error'}`);
  }
}

module.exports = { ProviderRouter };
