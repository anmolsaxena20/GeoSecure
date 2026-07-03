// import { pool } from "./db.js";
// import { saveArticle } from "./articles.js";
// import { saveEvent } from "./events.js";

// function computeRiskScore(signal) {
//   let score = 0;

//   switch (signal.risk_level) {
//     case "CRITICAL":
//       score += 90;
//       break;
//     case "HIGH":
//       score += 70;
//       break;
//     case "MEDIUM":
//       score += 40;
//       break;
//     default:
//       score += 20;
//   }

//   if (signal.event_type === "PORT_DISRUPTION")
//     score += 20;

//   if (signal.event_type === "SANCTIONS")
//     score += 20;

//   if (signal.event_type === "TRADE_POLICY_CHANGE")
//     score += 15;

//   if (signal.event_type === "ENERGY_SHOCK")
//     score += 20;

//   if (signal.event_type === "NATURAL_DISASTER")
//     score += 15;

//   return Math.min(score, 100);
// }

// export async function persistSupplyChainReport(report) {
//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     for (const signal of report.critical_signals || []) {
//       const articleRow = await saveArticle(
//         {
//           source: signal.source,
//           external_id: signal.url,
//           headline: signal.headline,
//           url: signal.url,
//           published_at: signal.published_at,
//           body: signal.why_it_matters,
//         },
//         client
//       );

//       const event = {
//         event_type: signal.event_type,
//         summary: signal.why_it_matters,
//         countries: signal.affected_regions || [],
//         commodities:
//           signal.commodities?.filter(
//             (item) => item !== "None"
//           ) || [],
//         transport_modes:
//           signal.transport_modes?.filter(
//             (item) => item !== "None"
//           ) || [],
//         impacts: report.implications_for_trade_driven_economies || [],
//         recommendations: report.near_term_actions_for_users || [],
//         risk_score: computeRiskScore(signal),
//         risk_level: signal.risk_level,
//       };

//       await saveEvent(articleRow.id, event, client);
//     }

//     await client.query("COMMIT");

//     console.log(
//       `[db] Saved ${report.critical_signals.length} events`
//     );
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("[db] Transaction failed:", err.message);
//     throw err;
//   } finally {
//     client.release();
//   }
// }
import { pool } from "./db.js";
import { saveArticle } from "./articles.js";
import { saveEvent } from "./events.js";

export async function persistSupplyChainReport(report) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        for (const signal of report.critical_signals || []) {
            const article = await saveArticle({
                source: signal.source,
                headline: signal.headline,
                url: signal.url,
                published_at: signal.published_at
            }, client);

            await saveEvent(article.id, {
                event_type: signal.event_type,
                summary: signal.why_it_matters,
                countries: signal.affected_countries,
                commodities: signal.commodities,
                transport_modes: signal.transport_modes,
                impacts: signal.expected_supply_chain_effects,
                recommendations: signal.mitigation_suggestions,
                risk_score: signal.risk_score,
                risk_level: signal.risk_level
            }, client);
        }

        await client.query("COMMIT");

        console.log(
            `[db] Saved ${report.critical_signals.length} events`
        );
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}