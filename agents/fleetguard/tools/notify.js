'use strict';

function buildAlertMessage({ severity = 'info', title, details }) {
  return `[FleetGuard:${severity.toUpperCase()}] ${title}${details ? ` :: ${details}` : ''}`;
}

module.exports = { buildAlertMessage };
