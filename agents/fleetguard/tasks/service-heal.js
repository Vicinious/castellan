'use strict';

const SAFE_SERVICES = ['nginx', 'docker', 'ssh'];

async function serviceHealTask({ execTool, logger, service = 'nginx' }) {
  if (!SAFE_SERVICES.includes(service)) {
    return { ok: false, skipped: true, reason: 'service_not_allowlisted', service };
  }

  try {
    await execTool({ command: `systemctl is-active ${service}` });
    return { ok: true, healed: false, service, status: 'active' };
  } catch {
    try {
      await execTool({ command: `systemctl restart ${service}` });
      if (logger) logger.warn('fleetguard_service_restarted', { service });
      return { ok: true, healed: true, service, action: 'restart' };
    } catch (err) {
      if (logger) logger.error('fleetguard_service_heal_failed', { service, error: err.message || String(err) });
      return { ok: false, healed: false, service, error: err.message || String(err) };
    }
  }
}

module.exports = { serviceHealTask, SAFE_SERVICES };
