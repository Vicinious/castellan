'use strict';

const ANALYSIS_PROMPT = `Analyze this competitor update:

Competitor: {competitor}
Recent news/changes: {content}

Provide brief analysis:
1. What changed?
2. Impact on us?
3. Action recommended?

Output JSON: { "changes": "...", "impact": "...", "action": "..." }`;

async function competitorCheckTask({ db, config, logger, webSearchTool, webFetchTool, llmTool }) {
  const competitors = config.research?.competitors || [];
  const results = [];

  for (const competitor of competitors) {
    try {
      // Search for recent news about competitor
      const searchResults = await webSearchTool({
        query: `"${competitor}" announcement OR update OR release ${new Date().getFullYear()}`,
        count: 3
      });

      const items = JSON.parse(searchResults.stdout || '[]');
      
      if (items.length === 0) continue;

      // Get content from top result
      let content = items[0].snippet;
      try {
        const fetched = await webFetchTool({ url: items[0].url });
        content = (fetched.content || '').slice(0, 2000);
      } catch (e) {
        // Use snippet if fetch fails
      }

      // Analyze with LLM
      const prompt = ANALYSIS_PROMPT
        .replace('{competitor}', competitor)
        .replace('{content}', content);

      const response = await llmTool({ prompt, maxTokens: 300 });
      const match = response.content.match(/\{[\s\S]*\}/);

      if (match) {
        const analysis = JSON.parse(match[0]);
        results.push({
          competitor,
          url: items[0].url,
          ...analysis,
          checkedAt: new Date().toISOString()
        });

        // Store in DB
        if (db) {
          db.run(
            `INSERT OR REPLACE INTO kv_store (key, value, namespace, created_at)
             VALUES (:key, :value, 'competitor_intel', datetime('now'))`,
            {
              key: `competitor-${competitor.replace(/[^a-z0-9]/gi, '-')}`,
              value: JSON.stringify(results[results.length - 1])
            }
          );
        }

        if (analysis.impact?.toLowerCase().includes('high') && logger) {
          logger.warn('competitor_significant_change', { competitor, changes: analysis.changes });
        }
      }
    } catch (e) {
      if (logger) logger.warn('competitor_check_error', { competitor, error: e.message });
    }
  }

  if (logger) logger.info('competitor_check_complete', { 
    checked: competitors.length,
    findings: results.length 
  });

  return { ok: true, results };
}

module.exports = { competitorCheckTask };
