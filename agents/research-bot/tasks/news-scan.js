'use strict';

const RELEVANCE_PROMPT = `You are filtering news for relevance.

Topics of interest: {topics}

Article:
Title: {title}
Snippet: {snippet}

Rate relevance 0-10 and explain briefly.
Output JSON: { "score": N, "reason": "..." }`;

async function newsScanTask({ db, config, logger, webSearchTool, llmTool }) {
  const topics = config.research?.topics || ['AI', 'technology'];
  const maxFindings = config.output?.maxFindingsPerRun || 10;
  
  const findings = [];

  for (const topic of topics.slice(0, 3)) { // Limit to 3 topics per run
    try {
      const results = await webSearchTool({ 
        query: `${topic} news ${new Date().toISOString().slice(0, 10)}`,
        count: 5
      });

      const items = JSON.parse(results.stdout || '[]');

      for (const item of items.slice(0, 5)) {
        // Check relevance
        const prompt = RELEVANCE_PROMPT
          .replace('{topics}', topics.join(', '))
          .replace('{title}', item.title || '')
          .replace('{snippet}', item.snippet || '');

        try {
          const response = await llmTool({ prompt, maxTokens: 150 });
          const match = response.content.match(/\{[\s\S]*\}/);
          
          if (match) {
            const relevance = JSON.parse(match[0]);
            
            if (relevance.score >= 6) {
              findings.push({
                topic,
                title: item.title,
                url: item.url,
                snippet: item.snippet,
                relevanceScore: relevance.score,
                relevanceReason: relevance.reason,
                foundAt: new Date().toISOString()
              });
            }
          }
        } catch (e) {
          // Skip items that fail relevance check
        }
      }
    } catch (e) {
      if (logger) logger.warn('news_scan_topic_error', { topic, error: e.message });
    }
  }

  // Store findings
  if (db && findings.length > 0) {
    for (const finding of findings.slice(0, maxFindings)) {
      const key = `finding-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      db.run(
        `INSERT INTO kv_store (key, value, namespace, created_at)
         VALUES (:key, :value, 'research_findings', datetime('now'))`,
        { key, value: JSON.stringify(finding) }
      );
    }
  }

  if (logger) logger.info('news_scan_complete', { 
    topics: topics.length,
    findings: findings.length 
  });

  return { ok: true, findings };
}

module.exports = { newsScanTask };
