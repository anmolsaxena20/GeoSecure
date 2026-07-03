import { pool } from "./db.js";

export async function saveArticle(article) {
    const result = await pool.query(
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
        ON CONFLICT (external_id)
        DO NOTHING
        RETURNING id
        `,
        [
            article.source,
            article.id,
            article.headline,
            article.url,
            article.published_at,
            article.content
        ]
    );

    return result.rows[0];
}