import { SupplyChainEconomiesAgent } from "../agents/supply_chain_economies_agent.js";
import { pool } from "../db/db.js";

/**
 * Triggers the supply chain economies agent analysis cycle.
 * Gathers news, macroeconomic metrics, commodity prices, trade statistics, weather,
 * and natural disasters to construct a structured analysis, persists it, and returns the output.
 * 
 * @returns {Promise<Object>} The structured economies analysis report
 */
export async function runSupplyChainEconomiesAgent() {
    const agent = new SupplyChainEconomiesAgent();
    return await agent.run();
}

/**
 * Retrieves high-risk events from the database (HIGH or CRITICAL levels).
 * 
 * @returns {Promise<Array>} List of high-risk events sorted by risk score descending
 */
export async function getHighRiskEvents() {
    const result = await pool.query(
        `
        SELECT *
        FROM events
        WHERE risk_level IN ('HIGH', 'CRITICAL')
        ORDER BY risk_score DESC, id DESC
        `
    );
    return result.rows;
}
