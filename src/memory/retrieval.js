'use strict';

function estimateTokens(s) {
  return Math.ceil(String(s || '').length / 4);
}

function buildBudgetedContext({ working, longTerm, procedures, budgets = {} }) {
  const b = {
    working: budgets.working ?? 8000,
    longTerm: budgets.longTerm ?? 4000,
    procedural: budgets.procedural ?? 2000,
  };

  const lines = [];
  let used = { working: 0, longTerm: 0, procedural: 0 };

  for (const e of working || []) {
    const t = Number(e.tokens || estimateTokens(e.content));
    if (used.working + t > b.working) continue;
    used.working += t;
    lines.push(`[W] ${e.content}`);
  }

  for (const f of longTerm || []) {
    const text = `${f.subject} ${f.predicate} ${f.object}`;
    const t = estimateTokens(text);
    if (used.longTerm + t > b.longTerm) continue;
    used.longTerm += t;
    lines.push(`[L] ${text}`);
  }

  for (const p of procedures || []) {
    const text = `${p.name}: ${p.description}`;
    const t = estimateTokens(text);
    if (used.procedural + t > b.procedural) continue;
    used.procedural += t;
    lines.push(`[P] ${text}`);
  }

  return { context: lines.join('\n'), tokenUsage: used, budgets: b };
}

module.exports = { estimateTokens, buildBudgetedContext };
