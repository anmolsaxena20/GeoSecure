import axios from "axios";
import cron from "node-cron";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { pool } from "../db/db.js";
import { saveArticle } from "../db/articles.js";
import { saveEvent } from "../db/events.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const LOG_FILE_PATH = path.resolve(__dirname, "../logs/supply_chain_polling_agent.log");

const SCHEMA_TEMPLATE = {
  generated_at: "",
  market_snapshot: "",
  critical_signals: [
    {
      headline: "",
      published_at: "",
      source: "The Guardian",
      url: "",
      event_type: "",
      affected_regions: [],
      transport_modes: [],
      commodities: [],
      risk_level: "LOW",
      why_it_matters: "",
      likely_impact_horizon: "",
    },
  ],
  implications_for_trade_driven_economies: [""],
  near_term_actions_for_users: [""],
};

const SUPPLY_CHAIN_KEYWORDS = [
  "supply chain",
  "logistics",
  "shipping",
  "freight",
  "port",
  "canal",
  "air cargo",
  "tariff",
  "sanction",
  "customs",
  "export",
  "import",
  "container",
  "rail",
  "trucking",
  "warehouse",
  "energy",
  "oil",
  "diesel",
  "lpg",
  "lng",
  "pipeline",
  "trade route",
];

const NOISE_PATTERN =
  /(football|soccer|smoking|celebrity|fashion|euphoria|relationships|lifestyle|horoscope|crossword|sudoku|culture review)/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error) {
  const msg = String(error?.message || "");
  return (
    msg.includes("429") ||
    msg.includes("rate_limit_exceeded") ||
    msg.includes("tokens per minute")
  );
}

async function invokeWithRetry(app, payload, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await app.invoke(payload);
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxAttempts) throw error;
      const waitMs = Math.min(30000, 2000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 1000);
      console.warn(`[agent] Rate limit hit. Retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
}

function normalizeArticles(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id ?? null, // guardian content id (best unique key)
    headline: item.webTitle ?? item.fields?.headline ?? "Untitled",
    section: item.sectionName ?? "Unknown",
    published_at: item.webPublicationDate ?? new Date().toISOString(),
    url: item.webUrl ?? "",
    trail: item.fields?.trailText ?? "",
    body: String(item.fields?.bodyText ?? "").slice(0, 500), // token control
  }));
}

function isRelevantSupplyChainArticle(article) {
  const text = `${article.headline || ""} ${article.trail || ""} ${article.body || ""}`.toLowerCase();
  const hasKeyword = SUPPLY_CHAIN_KEYWORDS.some((k) => text.includes(k));
  const isNoise = NOISE_PATTERN.test(text);
  return hasKeyword && !isNoise;
}

function parseJsonLoose(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return JSON.parse(raw.slice(objectStart, objectEnd + 1));
  }

  throw new Error("No valid JSON found in model output.");
}

function getFinalModelText(result) {
  const last = result.messages[result.messages.length - 1];
  if (!last || typeof last.content === "undefined") return "";

  if (typeof last.content === "string") return last.content;

  if (Array.isArray(last.content)) {
    return last.content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("\n")
      .trim();
  }

  return String(last.content);
}

async function coerceStructuredJson(rawText) {
  const formatter = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    temperature: 0,
    maxRetries: 2,
  });

  const repairPrompt = [
    "Convert to strict valid JSON only.",
    "No markdown.",
    "Use this schema shape exactly:",
    JSON.stringify(SCHEMA_TEMPLATE, null, 2),
    "Fill missing fields safely.",
    "Input:",
    String(rawText || ""),
  ].join("\n");

  const response = await formatter.invoke([
    { role: "system", content: "You are a strict JSON formatter." },
    { role: "user", content: repairPrompt },
  ]);

  const text =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
      ? response.content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("\n")
      : String(response.content || "");

  return parseJsonLoose(text);
}

function buildGuardianQuery() {
  return [
    "(",
    '"supply chain" OR logistics OR shipping OR freight OR port OR canal OR "air cargo" OR customs OR tariff OR sanctions OR "export restriction" OR "import restriction" OR trucking OR warehouse OR "rail disruption" OR energy OR oil OR diesel',
    ")",
    "AND NOT (football OR soccer OR smoking OR fashion OR celebrity OR euphoria OR horoscope OR crossword)",
  ].join(" ");
}

function createGraphApp() {
  const fetchSupplyChainNews = tool(
    async ({ limit }) => {
      if (!process.env.GUARDIAN_API_KEY) {
        throw new Error("GUARDIAN_API_KEY is missing. Add it to ai/.env.");
      }

      const response = await axios.get("https://content.guardianapis.com/search", {
        params: {
          q: buildGuardianQuery(),
          section: "business|world|environment",
          "show-fields": "headline,trailText,bodyText",
          "order-by": "newest",
          "page-size": Math.max(5, Math.min(Number(limit) || 8, 12)),
          "api-key": process.env.GUARDIAN_API_KEY,
        },
      });

      const normalized = normalizeArticles(response.data?.response?.results ?? []);
      const filtered = normalized.filter(isRelevantSupplyChainArticle).slice(0, Math.max(5, Math.min(Number(limit) || 8, 12)));

      return JSON.stringify(filtered);
    },
    {
      name: "fetch_supply_chain_news",
      description:
        "Fetch latest relevant supply-chain/logistics/trade disruption news from The Guardian.",
      schema: z.object({
        limit: z.number().int().min(5).max(12).default(8),
      }),
    }
  );

  const tools = [fetchSupplyChainNews];

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    temperature: 0,
    maxRetries: 2,
  }).bindTools(tools);

  const toolNode = new ToolNode(tools);

  async function callModel(state) {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  }

  function shouldContinue(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    return lastMessage.tool_calls?.length > 0 ? "tools" : END;
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      [END]: END,
    })
    .addEdge("tools", "agent")
    .compile();
}

function riskLevelToScore(level) {
  switch ((level || "").toUpperCase()) {
    case "CRITICAL":
      return 90;
    case "HIGH":
      return 75;
    case "MEDIUM":
      return 50;
    case "LOW":
      return 25;
    default:
      return 10;
  }
}

function isValidEventType(v) {
  return [
    "PORT_DISRUPTION",
    "LABOR_STRIKE",
    "SHIPPING_DISRUPTION",
    "TRADE_POLICY_CHANGE",
    "SANCTIONS",
    "EXPORT_RESTRICTION",
    "IMPORT_RESTRICTION",
    "ENERGY_SHOCK",
    "CYBER_ATTACK",
    "NATURAL_DISASTER",
    "INFRASTRUCTURE_FAILURE",
    "GEOPOLITICAL_EVENT",
    "OTHER",
  ].includes(String(v || "").toUpperCase());
}

function isValidTransportMode(mode) {
  return ["Ocean", "Air", "Rail", "Road", "Pipeline"].includes(mode);
}

function sanitizeEvent(signal, structured) {
  const eventType = isValidEventType(signal.event_type) ? signal.event_type.toUpperCase() : "OTHER";
  const transportModes = (Array.isArray(signal.transport_modes) ? signal.transport_modes : []).filter(isValidTransportMode);

  return {
    event_type: eventType,
    summary: String(signal.why_it_matters ?? "").slice(0, 1500),
    countries: Array.isArray(signal.affected_regions) ? signal.affected_regions : [],
    commodities: Array.isArray(signal.commodities) ? signal.commodities : [],
    transport_modes: transportModes,
    impacts: [signal.likely_impact_horizon].filter(Boolean),
    recommendations: Array.isArray(structured?.near_term_actions_for_users)
      ? structured.near_term_actions_for_users.slice(0, 5)
      : [],
    risk_score: riskLevelToScore(signal.risk_level),
    risk_level: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(signal.risk_level || "").toUpperCase())
      ? String(signal.risk_level).toUpperCase()
      : "LOW",
  };
}

async function persistStructuredOutput(structured) {
  const signals = Array.isArray(structured?.critical_signals) ? structured.critical_signals : [];
  if (!signals.length) return { saved: 0, skipped: 0 };

  const client = await pool.connect();
  let saved = 0;
  let skipped = 0;

  try {
    await client.query("BEGIN");

    for (const signal of signals) {
      const headline = String(signal.headline ?? "").trim();
      const url = String(signal.url ?? "").trim();

      if (!headline || !url || !url.includes("theguardian.com")) {
        skipped++;
        continue;
      }

      const articlePayload = {
        source: signal.source ?? "The Guardian",
        // stable dedupe key: url
        id: url,
        headline,
        url,
        published_at: signal.published_at ?? new Date().toISOString(),
        body: signal.why_it_matters ?? "",
        trail: "",
      };

      const articleRow = await saveArticle(articlePayload, client);
      if (!articleRow?.id) {
        skipped++;
        continue;
      }

      const eventPayload = sanitizeEvent(signal, structured);

      // avoid junk summary
      if (!eventPayload.summary || eventPayload.summary.length < 20) {
        skipped++;
        continue;
      }

      await saveEvent(articleRow.id, eventPayload, client);
      saved++;
    }

    await client.query("COMMIT");
    return { saved, skipped };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

class SupplyChainLangGraphPollingAgent {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
    }

    this.schedule = process.env.SUPPLY_CHAIN_CRON || "*/10 * * * *";
    this.maxItems = Number(process.env.SUPPLY_CHAIN_MAX_ITEMS || 5);
    this.isRunningCycle = false;
    this.cronTask = null;
    this.app = createGraphApp();
  }

  async start({ runOnce = false } = {}) {
    console.log(`[agent] Starting LangGraph supply-chain agent. schedule=${this.schedule}`);
    await this.runCycle("startup");

    if (runOnce) return;

    this.cronTask = cron.schedule(this.schedule, async () => {
      await this.runCycle("cron");
    });

    this.attachShutdownHandlers();
    console.log("[agent] Polling started.");
  }

  async stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
    console.log("[agent] Polling stopped.");
  }

  attachShutdownHandlers() {
    const shutdown = async () => {
      console.log("[agent] Shutdown signal received.");
      await this.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  async runCycle(trigger) {
    if (this.isRunningCycle) {
      console.log("[agent] Previous cycle still running. Skipping.");
      return;
    }

    this.isRunningCycle = true;

    try {
      const now = new Date().toISOString();
      console.log(`\n[agent] Running cycle (${trigger}) at ${now}`);

      const result = await invokeWithRetry(
        this.app,
        {
          messages: [
            new HumanMessage(
              [
                "You are a supply-chain and logistics intelligence agent for users in trade-driven economies.",
                "First call fetch_supply_chain_news exactly once.",
                `Use only fetched articles. Keep at most ${this.maxItems} strongest signals.`,
                "Return ONLY valid JSON in this exact schema shape:",
                JSON.stringify(SCHEMA_TEMPLATE, null, 2),
                "Rules:",
                "- event_type must be one of: PORT_DISRUPTION, LABOR_STRIKE, SHIPPING_DISRUPTION, TRADE_POLICY_CHANGE, SANCTIONS, EXPORT_RESTRICTION, IMPORT_RESTRICTION, ENERGY_SHOCK, CYBER_ATTACK, NATURAL_DISASTER, INFRASTRUCTURE_FAILURE, GEOPOLITICAL_EVENT, OTHER",
                "- risk_level must be one of: LOW, MEDIUM, HIGH, CRITICAL",
                "- transport_modes values can only be: Ocean, Air, Rail, Road, Pipeline",
                "- why_it_matters must be concise and user-friendly",
                "- implications_for_trade_driven_economies and near_term_actions_for_users must each contain 3 to 5 strings",
              ].join("\n")
            ),
          ],
        },
        5
      );

      const content = getFinalModelText(result);
      let structured;
      try {
        structured = parseJsonLoose(content);
      } catch {
        structured = await coerceStructuredJson(content);
      }

      // hard cap signals at maxItems
      if (Array.isArray(structured?.critical_signals)) {
        structured.critical_signals = structured.critical_signals.slice(0, this.maxItems);
      }

      const persistResult = await persistStructuredOutput(structured);
      console.log(
        `[agent] Persisted ${persistResult.saved} event(s), skipped ${persistResult.skipped}.`
      );

      await this.appendLog({
        timestamp: now,
        trigger,
        saved_events: persistResult.saved,
        skipped_events: persistResult.skipped,
      });
    } catch (error) {
      console.error("[agent] Cycle failed:", error.message);
      await this.appendLog({
        timestamp: new Date().toISOString(),
        trigger,
        error: error.message,
      });
    } finally {
      this.isRunningCycle = false;
    }
  }

  async appendLog(entry) {
    await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
    await fs.appendFile(LOG_FILE_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

const runOnce = process.argv.includes("--once");
const agent = new SupplyChainLangGraphPollingAgent();

agent.start({ runOnce }).catch((error) => {
  console.error("[agent] Fatal startup error:", error.message);
  process.exit(1);
});