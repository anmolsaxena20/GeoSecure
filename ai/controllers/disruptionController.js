import { DisruptionRiskAgent } from "../agents/disruption_risk_agent.js";
import { pool } from "../db/db.js";

/**
 * Triggers the disruption risk agent analysis cycle.
 * It fetches weather, news, events, and market indicators to assess disruption risk scores,
 * persists them to the database, and returns the analysis.
 * 
 * @returns {Promise<Object>} The structured corridor and commodity analysis results
 */
export async function runDisruptionAgent() {
    const agent = new DisruptionRiskAgent();
    return await agent.run();
}

/**
 * Retrieves the current corridor risk scores from the database.
 * 
 * @returns {Promise<Array>} List of corridor risk scores
 */
export async function getCorridorRiskScores() {
    const result = await pool.query(
        "SELECT * FROM corridor_risk_scores ORDER BY disruption_probability DESC, updated_at DESC;"
    );
    return result.rows;
}

/**
 * Retrieves the current commodity risk scores from the database.
 * 
 * @returns {Promise<Array>} List of commodity risk scores
 */
export async function getCommodityRiskScores() {
    const result = await pool.query(
        "SELECT * FROM commodity_risk_scores ORDER BY disruption_probability DESC, updated_at DESC;"
    );
    return result.rows;
}
