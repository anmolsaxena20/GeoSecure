import { llm } from "../configs/llm.js";
import { invokeWithRetry } from "../utils/retry.js";

export async function isRelevant(article) {
    const prompt = `
You are a supply chain intelligence classifier.

Determine whether the following news article has a direct or indirect impact on:

- Supply chains
- Logistics
- Freight
- Shipping
- Ports
- Customs
- Trade routes
- Manufacturing
- Warehousing
- Energy markets
- Transportation infrastructure

Examples of relevant events:
- Port closures
- Labor strikes
- Tariffs or sanctions
- Export restrictions
- Natural disasters affecting production
- Geopolitical conflicts affecting trade
- Energy shocks
- Cyber attacks on logistics infrastructure

Headline:
${article.headline}

Summary:
${article.trail}

Return ONLY valid JSON.

{
    "relevant": true,
    "reason": "short explanation"
}
`;

    try {
        const response = await invokeWithRetry(() =>
            llm.invoke(prompt)
        );

        const text =
            typeof response.content === "string"
                ? response.content
                : Array.isArray(response.content)
                ? response.content
                      .map((part) =>
                          typeof part === "string"
                              ? part
                              : part?.text || ""
                      )
                      .join("\n")
                : String(response.content);

        console.log("\n========== RELEVANCE CHECK ==========");
        console.log("Headline:", article.headline);
        console.log("LLM Response:", text);

        const parsed = JSON.parse(text);

        console.log(
            "Relevant:",
            parsed.relevant,
            "| Reason:",
            parsed.reason
        );

        return parsed.relevant === true;
    } catch (error) {
        console.error(
            "Relevance classification failed:",
            error.message
        );

        return false;
    }
}