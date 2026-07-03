import { ChatGroq } from "@langchain/groq";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ai/.env even when this script is run from ai/agents.
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });


const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    temperature: 0
});
function extractJson(text) {
    const raw = String(text).trim();

    // Case 1: Proper JSON already
    try {
        return JSON.parse(raw);
    } catch {}

    // Case 2: JSON inside markdown block
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (match) {
        return JSON.parse(match[1].trim());
    }

    // Case 3: Find first { and last }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start !== -1 && end !== -1) {
        return JSON.parse(raw.substring(start, end + 1));
    }

    throw new Error("No valid JSON found in model response.");
}
export async function buildReport(news, market) {
    const prompt = `
You are a supply chain intelligence analyst.

News:
${JSON.stringify(news)}

Market:
${JSON.stringify(market)}

Return JSON with:
generated_at
critical_signals
overall_risk_assessment
`;

    const response = await llm.invoke(prompt);

return extractJson(response.content);
}