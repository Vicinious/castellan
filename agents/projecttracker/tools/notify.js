'use strict';

function buildNotification({ severity = 'info', title, details = '' }) {
  return `[${severity.toUpperCase()}] ${title}${details ? ` :: ${details}` : ''}`;
}

module.exports = { buildNotification };
