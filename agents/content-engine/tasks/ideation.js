'use strict';

const IDEATION_PROMPT = `You are a content strategist for a tech/productivity blog.
Generate 5 unique article ideas based on current trends and the given categories.

Categories: {categories}

For each idea, provide:
1. Title (compelling, SEO-friendly)
2. Hook (1-2 sentences)
3. Target keywords (3-5)
4. Estimated word count
5. Content type (how-to, listicle, deep-dive, opinion)

Output as JSON array.`;

async function contentIdeationTask({ db, config, logger, webSearchTool, llmTool }) {
  const categories = config.content?.categories || ['tech', 'ai'];
  
  // Search for trending topics
  const trends = await webSearchTool({ 
    query: `trending ${categories.join(' ')} topics ${new Date().getFullYear()}`
  });

  const prompt = IDEATION_PROMPT
    .replace('{categories}', categories.join(', '));

  const response = await llmTool({ 
    prompt: prompt + `\n\nTrending context:\n${JSON.stringify(trends).slice(0, 2000)}`,
    maxTokens: 1500 
  });

  let ideas = [];
  try {
    // Extract JSON from response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      ideas = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    if (logger) logger.warn('content_ideation_parse_error', { error: e.message });
  }

  // Store ideas in DB
  if (db && ideas.length > 0) {
    for (const idea of ideas) {
      db.run(
        `INSERT INTO kv_store (key, value, namespace, created_at)
         VALUES (:key, :value, 'content_ideas', datetime('now'))`,
        {
          key: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          value: JSON.stringify(idea)
        }
      );
    }
  }

  if (logger) logger.info('content_ideation_complete', { count: ideas.length });

  return { ok: true, ideas };
}

module.exports = { contentIdeationTask };
