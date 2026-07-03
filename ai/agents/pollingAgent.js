import cron from "node-cron";

import { fetchGuardianArticles } from "../services/guardianService.js";
import { isRelevant } from "../services/relevanceService.js";
import { extractEvent } from "../services/extractionService.js";
import { computeRisk } from "../services/riskService.js";

let isRunning = false;

async function runCycle() {

    if (isRunning) {
        console.log("Previous cycle still running. Skipping...");
        return;
    }

    isRunning = true;

    try {
        console.log("Starting cycle:", new Date().toISOString());

        const articles = await fetchGuardianArticles(5);

        for (const article of articles) {

            const relevant = await isRelevant(article);

            if (!relevant) continue;

            const event = await extractEvent(article);

            event.risk_score = computeRisk(event);

            await saveEvent(event);

            await new Promise(resolve =>
                setTimeout(resolve, 3000)
            );
        }

        console.log("Cycle completed.");
    }
    catch (err) {
        console.error("Cycle failed:", err.message);
    }
    finally {
        isRunning = false;
    }
}

cron.schedule("*/15 * * * * *", runCycle);

runCycle();