import crypto from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = crypto;
}

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
import {persistSupplyChainReport} from "../db/persistence.js";
import { fetchMarketIntelligence } from "../tools/marketTool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const LOG_FILE_PATH = path.resolve(__dirname, "../logs/supply_chain_polling_agent.log");

const SEARCH_QUERY = [
  "supply chain",
  "logistics",
  "shipping",
  "freight",
  "port",
  "canal",
  "air cargo",
  "trade",
  "tariff",
  "sanctions",
  "export restriction",
  "import restriction",
  "energy shock",
  "rail disruption",
  "trucking",
  "warehouse",
  "customs",
].join(" OR ");

// const SCHEMA_TEMPLATE = {
//   generated_at: "",
//   market_snapshot: "",
//   critical_signals: [
//     {
//       headline: "",
//       published_at: "",
//       source: "The Guardian",
//       url: "",
//       event_type: "",
//       affected_regions: [],
//       transport_modes: [],
//       commodities: [],
//       risk_level: "LOW",
//       why_it_matters: "",
//       likely_impact_horizon: "",
//     },
//   ],
//   implications_for_trade_driven_economies: [""],
//   near_term_actions_for_users: [""],
// };
const SCHEMA_TEMPLATE = {
  generated_at: "",

  market_snapshot: {
    energy: {
      brent_crude_price: "",
      wti_crude_price: "",
      natural_gas_price: "",
      trend: "", // Rising / Falling / Stable
      impact_summary: ""
    },

    commodities: {
      copper_price: "",
      wheat_price: "",
      commodity_index: "",
      trend: "",
      impact_summary: ""
    },

    forex: {
      usd_inr: "",
      usd_cny: "",
      usd_eur: "",
      impact_summary: ""
    },

    logistics_stocks: [
      {
        symbol: "",
        company: "",
        price: "",
        change_percent: ""
      }
    ],

    semiconductor_stocks: [
      {
        symbol: "",
        company: "",
        price: "",
        change_percent: ""
      }
    ],

    macro_indicators: {
      global_trade_to_gdp: "",
      inflation_rate: "",
      gdp_growth_rate: "",
      container_port_traffic: ""
    },

    overall_market_sentiment: "",
    market_risk_level: "LOW"
  },

  critical_signals: [
    {
      headline: "",
      published_at: "",
      source: "",
      url: "",

      event_type: "",

      affected_regions: [],

      affected_countries: [],

      transport_modes: [],

      commodities: [],

      industries_impacted: [],

      companies_impacted: [],

      risk_level: "LOW",

      risk_score: 0,

      why_it_matters: "",

      likely_impact_horizon: "",

      expected_supply_chain_effects: [],

      mitigation_suggestions: []
    }
  ],

  implications_for_trade_driven_economies: [],

  near_term_actions_for_users: [],

  strategic_recommendations: [],

  overall_risk_assessment: {
    overall_risk_level: "LOW",

    key_drivers: [],

    most_vulnerable_regions: [],

    most_vulnerable_industries: [],

    recommended_monitoring_areas: []
  }
};
function normalizeArticles(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id,
    headline: item.webTitle ?? item.fields?.headline ?? "Untitled",
    section: item.sectionName ?? "Unknown",
    published_at: item.webPublicationDate ?? "Unknown",
    url: item.webUrl ?? "",
    trail: item.fields?.trailText ?? "",
    body: String(item.fields?.bodyText ?? "").slice(0, 1400),
  }));
}

function parseJsonLoose(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Continue to extraction fallback.
  }

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
  if (!last || typeof last.content === "undefined") {
    return "";
  }

  if (typeof last.content === "string") {
    return last.content;
  }

  if (Array.isArray(last.content)) {
    return last.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return String(last.content);
}

async function coerceStructuredJson(rawText) {
  const formatter = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature: 0,
    maxRetries: 2,
  });

  const repairPrompt = [
    "Convert the following model output into strict valid JSON.",
    "Return only JSON and no markdown.",
    "Use this target schema shape exactly:",
    JSON.stringify(SCHEMA_TEMPLATE, null, 2),
    "If any field is missing, fill with safe defaults.",
    "Output to convert:",
    String(rawText || ""),
  ].join("\n");

  const response = await formatter.invoke([
    { role: "system", content: "You are a strict JSON formatter." },
    { role: "user", content: repairPrompt },
  ]);

  const text = typeof response.content === "string"
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("\n")
      : String(response.content || "");

  return parseJsonLoose(text);
}

function createGraphApp() {
  const fetchSupplyChainNews = tool(
    async ({ limit }) => {
      if (!process.env.GUARDIAN_API_KEY) {
        throw new Error("GUARDIAN_API_KEY is missing. Add it to ai/.env.");
      }

      const response = await axios.get("https://content.guardianapis.com/search", {
        params: {
          q: SEARCH_QUERY,
          "show-fields": "headline,trailText,bodyText",
          "order-by": "newest",
          "page-size": Math.max(5, Math.min(Number(limit) || 15, 25)),
          "api-key": process.env.GUARDIAN_API_KEY,
        },
      });

      const normalized = normalizeArticles(response.data?.response?.results ?? []);
      return JSON.stringify(normalized);
    },
    {
      name: "fetch_supply_chain_news",
      description:
        "Fetch latest news relevant to global supply chain, logistics, trade, ports, freight, energy, and disruption signals.",
      schema: z.object({
        limit: z.number().int().min(5).max(25).default(15),
      }),
    }
  );
const tools = [
  fetchSupplyChainNews,
  fetchMarketIntelligence
];

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
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
    if (lastMessage.tool_calls?.length > 0) {
      return "tools";
    }
    return END;
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

class SupplyChainLangGraphPollingAgent {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
    }

    this.schedule = process.env.SUPPLY_CHAIN_CRON || "*/2 * * * *";
    this.maxItems = Number(process.env.SUPPLY_CHAIN_MAX_ITEMS || 8);
    this.isRunningCycle = false;
    this.cronTask = null;
    this.app = createGraphApp();
  }

  async start({ runOnce = false } = {}) {
    console.log(`[agent] Starting LangGraph supply-chain agent. schedule=${this.schedule}`);
    await this.runCycle("startup");

    if (runOnce) {
      return;
    }

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

      const result = await this.app.invoke({
        messages: [
          new HumanMessage([
  "You are a supply-chain and logistics intelligence agent for end users in trade-driven economies.",

  "Call fetch_supply_chain_news exactly once.",
  "Call fetch_market_intelligence exactly once.",

  `Use only the fetched information and keep at most ${this.maxItems} strongest signals.`,

  "Correlate news events with market signals including:",
  "- oil prices",
  "- natural gas prices",
  "- commodity prices",
  "- forex movements",
  "- logistics company stocks",
  "- semiconductor company stocks",
  "- global trade indicators",

  "Use market data to strengthen or weaken risk assessments.",

  "Examples:",
  "- Rising oil prices increase freight and transportation risk.",
  "- Falling semiconductor stocks may indicate weakening electronics demand.",
  "- Rising USD/INR increases import costs for India.",
  "- Falling trade-to-GDP ratio suggests slowing global trade activity.",

  "Then return ONLY valid JSON in this exact schema shape:",
  JSON.stringify(SCHEMA_TEMPLATE, null, 2),

  "Rules:",
  "- event_type must be one of: PORT_DISRUPTION, LABOR_STRIKE, SHIPPING_DISRUPTION, TRADE_POLICY_CHANGE, SANCTIONS, EXPORT_RESTRICTION, IMPORT_RESTRICTION, ENERGY_SHOCK, CYBER_ATTACK, NATURAL_DISASTER, INFRASTRUCTURE_FAILURE, GEOPOLITICAL_EVENT, OTHER",
  "- risk_level must be one of: LOW, MEDIUM, HIGH, CRITICAL",
  "- transport_modes values can only be: Ocean, Air, Rail, Road, Pipeline",
  "- why_it_matters must be concise and actionable",
  "- market_snapshot should summarize major commodity, stock, forex and macroeconomic movements affecting supply chains",
  "- implications_for_trade_driven_economies must contain 3-5 bullet style strings",
  "- near_term_actions_for_users must contain 3-5 bullet style strings"
].join("\n")),
        ],
      });

      const content = getFinalModelText(result);
      let structured;

      try {
        structured = parseJsonLoose(content);
      } catch {
        structured = await coerceStructuredJson(content);
      }

      console.log("[agent] Structured Supply Chain Brief:");
console.log(JSON.stringify(structured, null, 2));

await persistSupplyChainReport(structured);

await this.appendLog({
  timestamp: now,
  trigger,
  structured,
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

export { SupplyChainLangGraphPollingAgent };

if (process.argv[1] && process.argv[1].endsWith("supply_chain_polling_agent.js")) {
  const runOnce = process.argv.includes("--once");
  const agent = new SupplyChainLangGraphPollingAgent();
  agent.start({ runOnce }).catch((error) => {
    console.error("[agent] Fatal startup error:", error.message);
    process.exit(1);
  });
}

