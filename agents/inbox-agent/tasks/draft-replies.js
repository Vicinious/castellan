'use strict';

const DRAFT_PROMPT = `You are drafting an email reply.
Match the tone: {tone}

Original email:
From: {from}
Subject: {subject}
Body: {body}

Write a professional reply. Keep it concise (under {maxLength} words).
Do not include greeting/signature - those will be added automatically.

Output only the reply body text.`;

async function draftRepliesTask({ db, config, logger, gmailTool, llmTool }) {
  if (!db) {
    return { ok: false, error: 'no_db' };
  }

  // Get emails that need replies
  const rows = db.all(
    `SELECT key, value FROM kv_store 
     WHERE namespace = 'inbox_triage'
     AND json_extract(value, '$.needsReply') = 1
     AND json_extract(value, '$.draftCreated') IS NULL
     ORDER BY created_at ASC
     LIMIT 5`
  );

  if (rows.length === 0) {
    if (logger) logger.info('draft_replies_skipped', { reason: 'no_pending' });
    return { ok: true, drafted: 0 };
  }

  let drafted = 0;
  const results = [];

  for (const row of rows) {
    const triage = JSON.parse(row.value);
    
    // Fetch full email content
    let emailBody = '';
    try {
      const result = await gmailTool('read', { id: triage.emailId });
      const email = JSON.parse(result.stdout || '{}');
      emailBody = email.body || email.snippet || '';
    } catch (e) {
      if (logger) logger.warn('email_fetch_error', { id: triage.emailId, error: e.message });
      continue;
    }

    // Generate draft
    const prompt = DRAFT_PROMPT
      .replace('{tone}', config.drafts?.toneStyle || 'professional')
      .replace('{from}', triage.from)
      .replace('{subject}', triage.subject)
      .replace('{body}', emailBody.slice(0, 2000))
      .replace('{maxLength}', config.drafts?.maxDraftLength || 500);

    try {
      const response = await llmTool({ prompt, maxTokens: 600 });
      
      // Store draft (not creating actual Gmail draft to avoid accidental sends)
      triage.draftContent = response.content;
      triage.draftCreated = new Date().toISOString();

      db.run(
        `UPDATE kv_store SET value = :value WHERE key = :key`,
        { key: row.key, value: JSON.stringify(triage) }
      );

      drafted++;
      results.push({ id: triage.emailId, subject: triage.subject });

      if (logger) logger.info('draft_created', { subject: triage.subject });
    } catch (e) {
      if (logger) logger.error('draft_generation_error', { error: e.message });
    }
  }

  return { ok: true, drafted, results };
}

module.exports = { draftRepliesTask };
