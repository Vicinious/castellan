'use strict';

function ulid() {
  const t = Date.now().toString(36).padStart(10, '0');
  const r = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `${t}${r}`;
}

module.exports = { ulid };
