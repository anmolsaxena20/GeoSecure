import { ChatGroq } from "@langchain/groq";
import dotenv from "dotenv";
import {llm} from "../configs/llm.js";

export async function extractEvent(article) {

    const prompt = `
Extract supply chain impacts only.

Allowed event types:

PORT_DISRUPTION
SHIPPING_DISRUPTION
LABOR_STRIKE
TRADE_POLICY_CHANGE
SANCTIONS
ENERGY_SHOCK
NATURAL_DISASTER
CYBER_ATTACK
INFRASTRUCTURE_FAILURE
GEOPOLITICAL_EVENT
OTHER

Return JSON only:

{
    "event_type":"",
    "countries":[],
    "commodities":[],
    "transport_modes":[],
    "summary":"",
    "severity":5,
    "confidence":5
}

If article contains no supply chain disruption:

{
    "ignore": true
}
`;

    const response = await llm.invoke(prompt);

    return JSON.parse(response.content);
}