'use strict';

const path = require('node:path');

async function checkProjectsTask({ db, config, logger, execTool, readFileTool }) {
  const projects = config.projects || [];
  const staleDays = config.thresholds?.staleDays || 7;
  const results = [];

  for (const project of projects) {
    const status = {
      name: project.name,
      domain: project.domain,
      priority: project.priority,
      health: 'unknown',
      lastCommit: null,
      daysSinceCommit: null,
      stale: false
    };

    try {
      // Check git activity
      const gitResult = await execTool({
        command: `cd "${project.repoPath}" && git log -1 --format="%H|%ci|%s" 2>/dev/null || echo "NO_GIT"`
      });

      const gitOutput = (gitResult.stdout || '').trim();
      
      if (gitOutput && gitOutput !== 'NO_GIT') {
        const [hash, date, message] = gitOutput.split('|');
        status.lastCommit = {
          hash: hash?.slice(0, 8),
          date,
          message: message?.slice(0, 50)
        };

        const commitDate = new Date(date);
        const daysSince = Math.floor((Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24));
        status.daysSinceCommit = daysSince;
        status.stale = daysSince > staleDays;

        // Determine health
        if (daysSince <= 1) {
          status.health = 'active';
        } else if (daysSince <= staleDays) {
          status.health = 'normal';
        } else {
          status.health = 'stale';
        }
      } else {
        status.health = 'no_git';
      }

      // Check for blockers in project files
      try {
        const readmeResult = await readFileTool({ 
          path: path.join(project.repoPath, 'README.md') 
        });
        if (readmeResult.content?.toLowerCase().includes('blocked')) {
          status.hasBlocker = true;
        }
      } catch (e) {
        // README may not exist
      }

    } catch (e) {
      status.health = 'error';
      status.error = e.message;
      if (logger) logger.warn('project_check_error', { project: project.name, error: e.message });
    }

    results.push(status);

    // Store status
    if (db) {
      db.run(
        `INSERT OR REPLACE INTO kv_store (key, value, namespace, created_at, updated_at)
         VALUES (:key, :value, 'project_status', datetime('now'), datetime('now'))`,
        {
          key: `project-${project.name.toLowerCase().replace(/\s+/g, '-')}`,
          value: JSON.stringify(status)
        }
      );
    }

    if (status.stale && logger) {
      logger.warn('project_stale', { 
        project: project.name, 
        daysSinceCommit: status.daysSinceCommit 
      });
    }
  }

  if (logger) logger.info('project_check_complete', { 
    total: results.length,
    stale: results.filter(r => r.stale).length,
    active: results.filter(r => r.health === 'active').length
  });

  return { ok: true, projects: results };
}

module.exports = { checkProjectsTask };
