import { SupplyChainLangGraphPollingAgent } from "../agents/supply_chain_polling_agent.js";

/**
 * Triggers a single run cycle of the Supply Chain LangGraph Polling Agent.
 * 
 * @returns {Promise<Object>} Status of the agent execution cycle
 */
export async function runSupplyAgent() {
    const agent = new SupplyChainLangGraphPollingAgent();
    await agent.runCycle("manual_trigger");
    return { ok: true, message: "Supply chain polling agent cycle completed" };
}
