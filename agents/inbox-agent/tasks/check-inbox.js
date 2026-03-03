'use strict';

const TRIAGE_PROMPT = `You are an email triage assistant.
Analyze this email and classify it.

From: {from}
Subject: {subject}
Snippet: {snippet}

Categories: urgent, normal, low, newsletter, spam

Output JSON:
{
  "category": "<category>",
  "reason": "<brief reason>",
  "needsReply": true/false,
  "suggestedAction": "<action>"
}`;

async function checkInboxTask({ db, config, logger, gmailTool, llmTool }) {
  // Fetch recent unread emails
  let emails = [];
  try {
    const result = await gmailTool('list', { 
      query: 'is:unread', 
      limit: config.gmail?.maxFetchPerRun || 20 
    });
    emails = JSON.parse(result.stdout || '[]');
  } catch (e) {
    if (logger) logger.error('inbox_fetch_error', { error: e.message });
    return { ok: false, error: e.message };
  }

  if (emails.length === 0) {
    if (logger) logger.info('inbox_check_empty');
    return { ok: true, processed: 0 };
  }

  const results = [];
  const urgentKeywords = config.triage?.urgentKeywords || [];

  for (const email of emails) {
    // Quick keyword check for obvious urgency
    const subjectLower = (email.subject || '').toLowerCase();
    const hasUrgentKeyword = urgentKeywords.some(k => subjectLower.includes(k));

    // LLM triage for nuanced classification
    const prompt = TRIAGE_PROMPT
      .replace('{from}', email.from || 'Unknown')
      .replace('{subject}', email.subject || 'No Subject')
      .replace('{snippet}', (email.snippet || '').slice(0, 500));

    let triage = { category: 'normal', needsReply: false };
    try {
      const response = await llmTool({ prompt, maxTokens: 200 });
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        triage = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      if (logger) logger.warn('triage_parse_error', { error: e.message });
    }

    // Override with keyword if urgent
    if (hasUrgentKeyword && triage.category !== 'urgent') {
      triage.category = 'urgent';
    }

    // Store triage result
    if (db) {
      db.run(
        `INSERT INTO kv_store (key, value, namespace, created_at)
         VALUES (:key, :value, 'inbox_triage', datetime('now'))`,
        {
          key: `email-${email.id}`,
          value: JSON.stringify({
            emailId: email.id,
            from: email.from,
            subject: email.subject,
            ...triage,
            processedAt: new Date().toISOString()
          })
        }
      );
    }

    results.push({ id: email.id, ...triage });

    if (triage.category === 'urgent' && logger) {
      logger.warn('inbox_urgent_email', { 
        from: email.from, 
        subject: email.subject 
      });
    }
  }

  if (logger) logger.info('inbox_check_complete', { 
    processed: results.length,
    urgent: results.filter(r => r.category === 'urgent').length
  });

  return { ok: true, processed: results.length, results };
}

module.exports = { checkInboxTask };
