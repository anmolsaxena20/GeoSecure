import cron from "node-cron";

import { fetchGuardianNews } from "../services/guardianService.js";
import { classifyRelevance } from "../Agent_demo/relevanceAgent.js";
import { extractEvent } from "../Agent_demo/extractionAgent.js";
import { calculateRisk } from "../Agent_demo/scoringAgent.js";

import { saveArticle } from "../db/articles.js";
import { saveEvent } from "../db/events.js";

async function runCycle() {
  console.log("Starting cycle");

  const articles = await fetchGuardianNews(10);

  for (const article of articles) {
    const relevance = await classifyRelevance(article);

    if (!relevance.relevant || relevance.score < 7) {
      console.log("Skipped:", article.headline);
      continue;
    }

    const extracted = await extractEvent(article);

    if (extracted.ignore) {
      continue;
    }

    const risk = calculateRisk(extracted);

    const articleRow = await saveArticle(article);

    await saveEvent(articleRow.id, {
      ...extracted,
      ...risk,
    });

    console.log(
      "Saved:",
      extracted.event_type,
      risk.risk_level,
      article.headline,
    );
  }
}
export function startNewsCron() {
  cron.schedule("*/30 * * * *", async () => {
    console.log("running scheduled cron cycle");
    await runCycle();
  });
}
