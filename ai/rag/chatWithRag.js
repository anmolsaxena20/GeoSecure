import groq from "../configs/llm.js";
import { buildContext } from "./ragService.js";

export async function askGeoSecure(question) {

    const context = await buildContext(question);

    const prompt = `
You are GeoSecure AI.

You are an AI supply chain and geopolitical analyst.

Use the historical context below while answering.

If the context is insufficient, clearly mention that.

============================

Historical Context

${context}

============================

User Question

${question}

Provide:

1. Risk Analysis
2. Procurement Impact
3. Logistics Impact
4. Suggested Actions
`;

    const response =
        await groq.chat.completions.create({

            model: "llama-3.3-70b-versatile",

            messages: [

                {
                    role: "system",
                    content:
                        "You are a geopolitical and supply chain expert."
                },

                {
                    role: "user",
                    content: prompt
                }

            ],

            temperature: 0.3

        });

    return response.choices[0].message.content;

}