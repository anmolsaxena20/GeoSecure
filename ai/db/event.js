import { pool } from "./db.js";

export async function saveEvent(articleId, event) {
    await pool.query(
        `
        INSERT INTO events(
            article_id,
            event_type,
            summary,
            countries,
            commodities,
            transport_modes,
            impacts,
            recommendations,
            risk_score,
            risk_level
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        `,
        [
            articleId,
            event.event_type,
            event.summary,
            JSON.stringify(event.countries),
            JSON.stringify(event.commodities),
            JSON.stringify(event.transport_modes),
            JSON.stringify(event.impacts),
            JSON.stringify(event.recommendations),
            event.risk_score,
            event.risk_level
        ]
    );
}