'use strict';

const DIGEST_PROMPT = `You are generating a weekly project status digest.

Project statuses:
{projects}

Generate a brief, executive-style summary including:
1. Overall health (how many projects active vs stale)
2. Highlights (most active projects)
3. Concerns (stale projects, blockers)
4. Recommendations (what needs attention this week)

Keep it under 500 words. Use bullet points.`;

async function weeklyDigestTask({ db, config, logger, llmTool }) {
  if (!db) {
    return { ok: false, error: 'no_db' };
  }

  // Get all project statuses
  const rows = db.all(
    `SELECT value FROM kv_store 
     WHERE namespace = 'project_status'`
  );

  if (rows.length === 0) {
    if (logger) logger.info('weekly_digest_skipped', { reason: 'no_projects' });
    return { ok: true, skipped: true };
  }

  const projects = rows.map(r => JSON.parse(r.value));
  
  const prompt = DIGEST_PROMPT.replace(
    '{projects}',
    projects.map(p => 
      `- ${p.name} (${p.domain}, ${p.priority}): ${p.health}, ${p.daysSinceCommit ?? '?'} days since commit`
    ).join('\n')
  );

  let digest = '';
  try {
    const response = await llmTool({ prompt, maxTokens: 800 });
    digest = response.content;
  } catch (e) {
    if (logger) logger.error('digest_generation_error', { error: e.message });
    return { ok: false, error: e.message };
  }

  // Store digest
  const digestKey = `digest-${new Date().toISOString().slice(0, 10)}`;
  db.run(
    `INSERT OR REPLACE INTO kv_store (key, value, namespace, created_at)
     VALUES (:key, :value, 'project_digests', datetime('now'))`,
    {
      key: digestKey,
      value: JSON.stringify({
        date: new Date().toISOString(),
        projectCount: projects.length,
        staleCount: projects.filter(p => p.stale).length,
        activeCount: projects.filter(p => p.health === 'active').length,
        digest
      })
    }
  );

  if (logger) logger.info('weekly_digest_generated', { 
    projects: projects.length,
    stale: projects.filter(p => p.stale).length
  });

  return { ok: true, digest, projectCount: projects.length };
}

module.exports = { weeklyDigestTask };
