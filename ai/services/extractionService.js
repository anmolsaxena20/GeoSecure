import { llm } from "../configs/llm.js";
import { invokeWithRetry } from "../utils/retry.js";
export async function extractEvent(article) {

    const prompt = `
Extract supply chain event information.

Article:
${article.headline}

${article.trail}

${article.body}

Return JSON only:

{
  "event_type":"",
  "countries":[],
  "commodities":[],
  "risk_level":"",
  "summary":""
}
`;

   const response = await invokeWithRetry(() =>
    llm.invoke(prompt)
);

    return JSON.parse(response.content);
}