import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ChatGroq } from "@langchain/groq";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from ai/.env regardless of the current working directory.
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const SEARCH_QUERY = [
    "supply chain",
    "logistics",
    "shipping",
    "freight",
    "port",
    "container",
    "sanctions",
    "trade",
    "tariff",
    "war",
    "oil",
    "gas",
    "strike",
    "cyber attack",
    "infrastructure",
    "export ban",
    "import restriction"
].join(" OR ");

const ANALYSIS_PROMPT = `You are an expert Supply Chain Intelligence Analyst working for a global logistics risk monitoring platform.

You are an event extraction engine for a global supply chain intelligence platform.
Your job is to convert news articles into structured events that can later be analyzed by a separate risk engine.

IMPORTANT RULES:
1. Extract facts only.
2. Do not estimate risk scores.
3. Do not generate recommendations.
4. Do not infer impacts that are not explicitly supported by the article.
5. Every article must have exactly one primary event type.
6. If an article is not directly related to logistics, trade, manufacturing, transportation, energy, procurement, or geopolitics, still classify it using an appropriate low-priority event type.
7. Never leave event_type empty.

Allowed event types:

High Priority:
- PORT_STRIKE
- LABOR_STRIKE
- WAR
- SANCTIONS
- EXPORT_RESTRICTION
- IMPORT_RESTRICTION
- MARITIME_ATTACK
- ENERGY_SHOCK
- PORT_CLOSURE
- AIRSPACE_CLOSURE
- NATURAL_DISASTER
- CYBER_ATTACK
- TRADE_POLICY_CHANGE
- INFRASTRUCTURE_FAILURE
- SHIPPING_DISRUPTION

Low Priority:
- CORPORATE_EVENT
- CORPORATE_MERGER
- FISCAL_POLICY
- DOMESTIC_POLITICS
- MEDIA_REGULATION
- REGULATORY_CHANGE
- ELECTION_NEWS
- OTHER

Extract the following entities:
- countries
- locations
- ports
- airports
- canals
- companies
- commodities
- transportation modes

Transportation modes can only contain:
- Ocean
- Air
- Rail
- Road
- Pipeline

Return ONLY valid JSON in this exact schema:

{
"event_type": "",
"headline": "",
"countries": [],
"locations": [],
"ports": [],
"airports": [],
"canals": [],
"companies": [],
"commodities": [],
"transport_modes": [],
"summary": ""
}

Article to analyze:

{{ARTICLE_TEXT}}`;

const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    temperature: 0,
    maxRetries: 2
});

const ALLOWED_SECTIONS = new Set(["business", "world", "politics", "environment", "global-development", "uk-news", "us-news"]);
const SUPPLY_CHAIN_TERMS = [
    "supply chain",
    "logistics",
    "shipping",
    "freight",
    "container",
    "port",
    "canal",
    "customs",
    "tariff",
    "sanction",
    "export",
    "import",
    "war",
    "oil",
    "gas",
    "diesel",
    "rail",
    "truck",
    "cargo",
    "strike",
    "cyber",
    "infrastructure",
    "airspace",
    "closure",
    "disruption"
];

const VALID_EVENT_TYPES = new Set([
    "PORT_STRIKE",
    "LABOR_STRIKE",
    "WAR",
    "SANCTIONS",
    "EXPORT_RESTRICTION",
    "IMPORT_RESTRICTION",
    "MARITIME_ATTACK",
    "ENERGY_SHOCK",
    "PORT_CLOSURE",
    "AIRSPACE_CLOSURE",
    "NATURAL_DISASTER",
    "CYBER_ATTACK",
    "TRADE_POLICY_CHANGE",
    "INFRASTRUCTURE_FAILURE",
    "SHIPPING_DISRUPTION",
    "CORPORATE_EVENT",
    "CORPORATE_MERGER",
    "FISCAL_POLICY",
    "DOMESTIC_POLITICS",
    "MEDIA_REGULATION",
    "REGULATORY_CHANGE",
    "ELECTION_NEWS",
    "OTHER"
]);

const VALID_TRANSPORT_MODES = new Set(["Ocean", "Air", "Rail", "Road", "Pipeline"]);

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeExtraction(assessment, fallbackHeadline) {
    const eventType = String(assessment?.event_type ?? "OTHER").toUpperCase();
    const transportModes = toArray(assessment?.transport_modes).filter((mode) => VALID_TRANSPORT_MODES.has(String(mode)));

    const normalized = {
        event_type: VALID_EVENT_TYPES.has(eventType) ? eventType : "OTHER",
        headline: String(assessment?.headline ?? fallbackHeadline ?? "Untitled"),
        countries: toArray(assessment?.countries),
        locations: toArray(assessment?.locations),
        ports: toArray(assessment?.ports),
        airports: toArray(assessment?.airports),
        canals: toArray(assessment?.canals),
        companies: toArray(assessment?.companies),
        commodities: toArray(assessment?.commodities),
        transport_modes: transportModes,
        summary: String(assessment?.summary ?? "")
    };

    return normalized;
}

function toArticleText(article) {
    const title = article.webTitle ?? article.fields?.headline ?? "Untitled";
    const section = article.sectionName ?? "Unknown";
    const publishedAt = article.webPublicationDate ?? "Unknown";
    const trailText = article.fields?.trailText ?? "";
    const bodyText = (article.fields?.bodyText ?? "").slice(0, 1200);

    return [
        `Headline: ${title}`,
        `Section: ${section}`,
        `Published: ${publishedAt}`,
        `URL: ${article.webUrl ?? "Unknown"}`,
        `Trail: ${trailText}`,
        `Body: ${bodyText}`
    ].join("\n");
}

function prefilterArticles(articles) {
    return articles.filter((article) => {
        const section = String(article.sectionName ?? "").toLowerCase();
        if (!ALLOWED_SECTIONS.has(section)) {
            return false;
        }

        const title = article.webTitle ?? article.fields?.headline ?? "";
        const trail = article.fields?.trailText ?? "";
        const text = `${title} ${trail}`.toLowerCase();
        return SUPPLY_CHAIN_TERMS.some((term) => text.includes(term));
    });
}

function extractJson(text) {
    const raw = String(text ?? "").trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    return JSON.parse(candidate);
}

async function analyzeArticle(article) {
    const articleText = toArticleText(article);
    const prompt = ANALYSIS_PROMPT.replace("{{ARTICLE_TEXT}}", articleText);
    const result = await llm.invoke(prompt);
    const parsed = extractJson(result.content);
    const fallbackHeadline = article.webTitle ?? article.fields?.headline ?? "Untitled";
    const assessment = normalizeExtraction(parsed, fallbackHeadline);

    return assessment;
}

export async function fetchNews() {
    if (!process.env.GUARDIAN_API_KEY) {
        throw new Error("GUARDIAN_API_KEY is missing. Add it to ai/.env.");
    }

    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
    }
   
    const response = await axios.get(
        "https://content.guardianapis.com/search",
        {
            params: {
                q: SEARCH_QUERY,
                "show-fields": "headline,trailText,bodyText",
                "page-size": 15,
                "order-by": "newest",
                "api-key": process.env.GUARDIAN_API_KEY
            }
        }
    );

    return response.data.response.results ?? [];
}

fetchNews()
    .then(async (articles) => {
        const analyses = [];
        const prefiltered = prefilterArticles(articles);
        const candidates = (prefiltered.length > 0 ? prefiltered : articles).slice(0, 4);

        for (const article of candidates) {
            try {
                const assessment = await analyzeArticle(article);
                analyses.push(assessment);
            } catch {
                // Skip malformed model responses to preserve JSON-only output.
            }
        }

        const output = analyses;
        console.log(JSON.stringify(output, null, 2));
    })
    .catch((error) => {
        const message = axios.isAxiosError(error)
            ? (error.response?.data?.message || error.message)
            : error.message;
        console.log(JSON.stringify({ error: message }, null, 2));
    });