'use strict';

const os = require('node:os');

function pct(used, total) {
  if (!total) return 0;
  return Math.round((used / total) * 100);
}

async function fleetHealthCheck({ db, config, logger }) {
  const cpus = os.loadavg()[0];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsedPct = pct(totalMem - freeMem, totalMem);

  const status = {
    host: os.hostname(),
    cpuLoad1m: cpus,
    memUsedPct,
    ts: new Date().toISOString(),
  };

  if (db) {
    db.run(
      `INSERT INTO metrics (id, name, value, unit, dimensions_json, recorded_at)
       VALUES (:id, 'fleet_health_mem_used_pct', :value, 'percent', :dims, datetime('now'))`,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        value: memUsedPct,
        dims: JSON.stringify({ host: status.host, cpuLoad1m: cpus }),
      }
    );
  }

  const warn = memUsedPct >= (config?.thresholds?.memWarn ?? 90);
  if (warn && logger) logger.warn('fleetguard_mem_warn', status);

  return { ok: true, warn, status };
}

module.exports = { fleetHealthCheck };
