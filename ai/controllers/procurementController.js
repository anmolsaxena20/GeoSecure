import { AdaptiveProcurementOrchestrator, ensureProcurementTablesExist } from "../agents/adaptive_procurement_orchestrator.js";
import { pool } from "../db/db.js";

/**
 * Triggers the Adaptive Procurement Orchestrator agent cycle.
 * It gathers news, active disruptions, ports, routes, logistics scores, and currency metrics
 * to generate procurement recommendations, persists them to the database, and returns the analysis.
 * 
 * @returns {Promise<Object>} The structured procurement recommendations
 */
export async function runProcurementOrchestrator() {
    const agent = new AdaptiveProcurementOrchestrator();
    return await agent.run();
}

/**
 * Retrieves the current procurement recommendations from the database.
 * 
 * @returns {Promise<Array>} List of procurement recommendations sorted by date descending
 */
export async function getProcurementRecommendations() {
    try {
        await ensureProcurementTablesExist();
        const result = await pool.query(
            "SELECT * FROM procurement_recommendations ORDER BY created_at DESC, id DESC;"
        );
        return result.rows;
    } catch (error) {
        console.error("[procurement] Error fetching procurement recommendations:", error);
        return [];
    }
}

