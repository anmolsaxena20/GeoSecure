import { pool } from "./db.js";

export async function saveArticle(article, client = pool) {
  const result = await client.query(
    `
    INSERT INTO articles
    (
      source,
      external_id,
      headline,
      url,
      published_at,
      raw_content
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (url)
    DO UPDATE SET
      source = EXCLUDED.source,
      external_id = EXCLUDED.external_id,
      headline = EXCLUDED.headline,
      published_at = EXCLUDED.published_at,
      raw_content = EXCLUDED.raw_content
    RETURNING id
    `,
    [
      article.source ?? "The Guardian",
      article.external_id ?? null,
      article.headline ?? "Untitled",
      article.url,
      article.published_at ?? new Date().toISOString(),
      article.body ?? article.trail ?? null,
    ]
  );

  return result.rows[0]; // always returns id now
}