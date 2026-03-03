'use strict';

const path = require('node:path');

const DRAFT_PROMPT = `You are a professional content writer for a tech/productivity blog.
Write a complete article based on the following brief:

Title: {title}
Hook: {hook}
Keywords: {keywords}
Target word count: {wordCount}
Tone: {tone}

Requirements:
- Engaging introduction that hooks the reader
- Clear structure with H2/H3 headings
- Practical examples and actionable advice
- Strong conclusion with call-to-action
- SEO-optimized with natural keyword integration
- Include meta description (150-160 chars)

Output the article in Markdown format with frontmatter.`;

async function draftGenerationTask({ db, config, logger, llmTool, writeFileTool, topic }) {
  // Get a topic from ideas if not provided
  let ideaData = topic;
  
  if (!ideaData && db) {
    const row = db.get(
      `SELECT key, value FROM kv_store 
       WHERE namespace = 'content_ideas'
       ORDER BY created_at DESC LIMIT 1`
    );
    if (row) {
      ideaData = JSON.parse(row.value);
      // Mark as used
      db.run(`DELETE FROM kv_store WHERE key = :key`, { key: row.key });
    }
  }

  if (!ideaData) {
    if (logger) logger.info('draft_generation_skipped', { reason: 'no_ideas' });
    return { ok: true, skipped: true, reason: 'no_ideas' };
  }

  const prompt = DRAFT_PROMPT
    .replace('{title}', ideaData.title || 'Untitled')
    .replace('{hook}', ideaData.hook || '')
    .replace('{keywords}', (ideaData.keywords || []).join(', '))
    .replace('{wordCount}', ideaData.wordCount || config.content?.wordCountMin || 1000)
    .replace('{tone}', config.content?.tone || 'professional');

  const response = await llmTool({ prompt, maxTokens: 4000 });

  // Generate slug from title
  const slug = (ideaData.title || 'draft')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const filename = `${new Date().toISOString().slice(0, 10)}-${slug}.md`;
  const draftsDir = path.join(process.cwd(), 'drafts');
  const filePath = path.join(draftsDir, filename);

  // Write draft
  await writeFileTool({ path: filePath, content: response.content });

  // Store draft record
  if (db) {
    db.run(
      `INSERT INTO kv_store (key, value, namespace, created_at)
       VALUES (:key, :value, 'content_drafts', datetime('now'))`,
      {
        key: `draft-${slug}`,
        value: JSON.stringify({
          title: ideaData.title,
          filename,
          path: filePath,
          status: 'draft',
          createdAt: new Date().toISOString()
        })
      }
    );
  }

  if (logger) logger.info('draft_generation_complete', { title: ideaData.title, filename });

  return { ok: true, title: ideaData.title, filename };
}

module.exports = { draftGenerationTask };
