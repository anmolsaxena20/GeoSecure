import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ai/.env even when script is run from ai/utils.
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const API_KEY = process.env.GUARDIAN_API_KEY;

if (!API_KEY) {
    throw new Error("GUARDIAN_API_KEY is missing. Add it to ai/.env.");
}

// Store already seen article IDs to avoid duplicates
const seenArticles = new Set();
const pendingArticles = [];

function printArticle(article) {
    console.log("\nNew Article Found");
    console.log("Title:", article.webTitle);
    console.log("Section:", article.sectionName);
    console.log("Published:", article.webPublicationDate);
    console.log("URL:", article.webUrl);
}

async function fetchLatestNews() {
    try {
        const response = await axios.get(
            "https://content.guardianapis.com/search",
            {
                params: {
                    "api-key": API_KEY,
                    pageSize: 5,
                    orderBy: "newest",
                    showFields: "headline",
                },
            }
        );

        const articles = response.data.response.results;
        const unseen = [];

        for (const article of articles) {
            if (!seenArticles.has(article.id)) {
                seenArticles.add(article.id);
                unseen.push(article);
            }
        }

        // Add oldest unseen first so each interval releases one item in order.
        unseen.reverse();
        pendingArticles.push(...unseen);

        return unseen.length;
    } catch (err) {
        console.error("Polling failed:", err.message);
        return 0;
    }
}

const task = cron.schedule("*/15 * * * * *", async () => {
    console.log(`\nPolling at ${new Date().toLocaleTimeString()}`);

    if (pendingArticles.length === 0) {
        await fetchLatestNews();
    }

    const nextArticle = pendingArticles.shift();
    if (nextArticle) {
        printArticle(nextArticle);
    } else {
        console.log("No new article yet.");
    }
});

console.log("Guardian polling started...");

// Stop automatically after 2 minutes (optional)
setTimeout(() => {
    task.stop();
    console.log("Polling stopped.");
}, 120000);