import { StrategicReserveOptimisationAgent } from "../agents/strategic_reserve_optimisation_agent.js";

/**
 * Triggers the Strategic Reserve Optimisation agent cycle.
 * Evaluates strategic stockpiles, optimal drawdowns, emergency reserves, and replenishment schedules.
 * 
 * @returns {Promise<Object>} The structured strategic reserve analysis
 */
export async function runStrategicReserveAgent() {
    const agent = new StrategicReserveOptimisationAgent();
    return await agent.run();
}
