import { ChatGroq } from "@langchain/groq";
import dotenv from "dotenv";
import {llm} from "../configs/llm.js";

export async function classifyRelevance(article) {
  const prompt = `
You are a supply chain intelligence classifier.

Return JSON only:

{
  "relevant": true,
  "score": 8,
  "reason": ""
}

Mark relevant ONLY if the article directly impacts:

- ports
- shipping
- logistics
- customs
- freight
- manufacturing
- commodities
- trade routes
- sanctions
- energy supply

Examples of NOT relevant:

- sports
- entertainment
- elections
- celebrity news
- local crime
- domestic politics

Headline:
${article.headline}

Summary:
${article.trail}

Body:
${article.body}
`;

  const response = await llm.invoke(prompt);

  return JSON.parse(response.content);
}