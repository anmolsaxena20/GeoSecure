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

// Import DB operations
import { pool } from "../db/db.js";
import { persistSupplyChainReport } from "../db/persistence.js";

// Import services
import { fetchGuardianNews } from "../services/guardianService.js";
import { fetchWorldBankIndicators } from "../services/worldBankService.js";
import { fetchCommodities, fetchForex, fetchStocks } from "../services/alphaVantageService.js";
import { fetchUNComtradeData } from "../services/unComtradeService.js";
import { fetchChokepointWeather, fetchNasaEonetEvents } from "../services/weatherDisasterService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const LOG_FILE_PATH = path.resolve(__dirname, "../logs/supply_chain_economies_agent.log");

// Schema representing the structured output required by the system
const SCHEMA_TEMPLATE = {
  generated_at: "",
  market_snapshot: {
    energy_prices: {
      brent_crude: "",
      wti_crude: "",
      natural_gas: "",
    },
    commodity_indicators: {
      copper: "",
      wheat: "",
      overall_commodity_index: "",
    },
    exchange_rates: {
      usd_inr: "",
    },
    logistics_and_manufacturing_stocks: [
      {
        symbol: "",
        price: "",
        change_percent: ""
      }
    ],
    macroeconomic_indicators: {
      trade_to_gdp_ratio: "",
      inflation_rate: "",
      gdp_growth_rate: "",
      container_port_traffic: ""
    },
    un_comtrade_trade_flows: [
      {
        year: "",
        reporterCode: 0,
        partnerCode: 0,
        flow: "",
        commodityCode: "",
        tradeValueUSD: 0
      }
    ],
    chokepoint_weather: [
      {
        location: "",
        temp_celsius: 0,
        wind_speed_kmh: 0,
        weather_code: 0,
        rain_mm: 0
      }
    ],
    active_natural_disasters: [
      {
        id: "",
        title: "",
        category: "",
        date: "",
        coordinates: []
      }
    ]
  },
  critical_signals: [
    {
      headline: "",
      published_at: "",
      source: "",
      url: "",
      event_type: "PORT_DISRUPTION", // choose from: PORT_DISRUPTION, LABOR_STRIKE, SHIPPING_DISRUPTION, TRADE_POLICY_CHANGE, SANCTIONS, EXPORT_RESTRICTION, IMPORT_RESTRICTION, ENERGY_SHOCK, CYBER_ATTACK, NATURAL_DISASTER, INFRASTRUCTURE_FAILURE, GEOPOLITICAL_EVENT, OTHER
      why_it_matters: "",
      affected_countries: [],
      commodities: [],
      transport_modes: [], // choose from: Ocean, Air, Rail, Road, Pipeline
      expected_supply_chain_effects: [],
      mitigation_suggestions: [],
      risk_score: 50, // 0 to 100
      risk_level: "MEDIUM" // LOW, MEDIUM, HIGH, CRITICAL
    }
  ],
  implications_for_trade_driven_economies: [],
  near_term_actions_for_users: []
};

// Helper to keep only the latest data points from Alpha Vantage time-series to prevent token limit issues.
// Only 1 entry is retained to stay well within Groq's free-tier TPM limits.
function trimCommodityData(rawCommodities) {
  const trimmed = {};
  for (const [key, val] of Object.entries(rawCommodities || {})) {
    if (val && Array.isArray(val.data)) {
      trimmed[key] = {
        name: val.name,
        unit: val.unit,
        data: val.data.slice(0, 1)   // keep only the single most-recent point
      };
    } else {
      trimmed[key] = val;
    }
  }
  return trimmed;
}

// Retry wrapper with exponential backoff — handles Groq 429 (rate-limit) and
// transient 5xx / network errors that have historically caused agent failures.
async function withRetry(fn, { maxAttempts = 4, baseDelayMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err?.message || "";
      // Only retry on rate-limit (429) or server-side (5xx) errors
      const isRetryable =
        msg.includes("429") ||
        msg.includes("rate_limit_exceeded") ||
        msg.includes("500") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("Connection error");
      if (!isRetryable || attempt === maxAttempts) throw err;
      const waitMs = baseDelayMs * Math.pow(2, attempt - 1); // 30s, 60s, 120s …
      console.warn(
        `[retry] Attempt ${attempt} failed (${msg.slice(0, 120)}). Retrying in ${waitMs / 1000}s…`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

// --- TOOL DEFINITIONS ---

const fetchNewsTool = tool(
  async () => {
    console.log("[tool] Fetching Guardian news...");
    try {
      const news = await fetchGuardianNews();
      return JSON.stringify(news);
    } catch (error) {
      console.error("[tool] Guardian news fetch failed:", error.message);
      return `Error fetching Guardian news: ${error.message}`;
    }
  },
  {
    name: "fetch_news",
    description: "Fetch supply chain, shipping, logistics, and sanctions news from the Guardian API.",
    schema: z.object({})
  }
);

const fetchWorldBankTool = tool(
  async () => {
    console.log("[tool] Fetching World Bank indicators...");
    try {
      const indicators = await fetchWorldBankIndicators();
      return JSON.stringify(indicators);
    } catch (error) {
      console.error("[tool] World Bank indicators fetch failed:", error.message);
      return `Error fetching World Bank indicators: ${error.message}`;
    }
  },
  {
    name: "fetch_world_bank",
    description: "Fetch macroeconomic indicators (trade-to-GDP, inflation, GDP growth, container traffic) from World Bank API.",
    schema: z.object({})
  }
);

const fetchAlphaVantageTool = tool(
  async () => {
    console.log("[tool] Fetching Alpha Vantage commodities, forex, and stocks (takes a few moments)...");
    try {
      const commodities = await fetchCommodities();
      const forex = await fetchForex();
      const stocks = await fetchStocks();
      const trimmedCommodities = trimCommodityData(commodities);
      return JSON.stringify({ commodities: trimmedCommodities, forex, stocks });
    } catch (error) {
      console.error("[tool] Alpha Vantage fetch failed:", error.message);
      return `Error fetching Alpha Vantage data: ${error.message}`;
    }
  },
  {
    name: "fetch_alpha_vantage",
    description: "Fetch real-time energy/commodities prices, USD/INR forex rates, and logistics/semiconductor stock quotes.",
    schema: z.object({})
  }
);

const fetchUNComtradeTool = tool(
  async (args) => {
    console.log("[tool] Fetching UN Comtrade commercial trade data...");
    try {
      const data = await fetchUNComtradeData(args || {});
      return JSON.stringify(data);
    } catch (error) {
      console.error("[tool] UN Comtrade fetch failed:", error.message);
      return `Error fetching UN Comtrade trade data: ${error.message}`;
    }
  },
  {
    name: "fetch_un_comtrade",
    description: "Fetch global commercial imports/exports trade flow volume and values from the UN Comtrade API.",
    schema: z.object({
      reporterCode: z.string().optional().describe("UN M49 code of reporting country (e.g., '356' for India, '51' for Armenia, 'all')"),
      partnerCode: z.string().optional().describe("UN M49 code of partner country (e.g. '0' for World)"),
      period: z.string().optional().describe("Year of reporting (e.g. '2025' or '2024')"),
      flowCode: z.string().optional().describe("'M' for Imports, 'X' for Exports"),
      cmdCode: z.string().optional().describe("HS commodity code (e.g. 'TOTAL', '30' for pharmaceuticals, '85' for electrical machinery)")
    })
  }
);

const fetchChokepointWeatherTool = tool(
  async () => {
    console.log("[tool] Fetching current weather at major shipping chokepoints...");
    try {
      const data = await fetchChokepointWeather();
      return JSON.stringify(data);
    } catch (error) {
      console.error("[tool] Weather fetch failed:", error.message);
      return `Error fetching chokepoint weather: ${error.message}`;
    }
  },
  {
    name: "fetch_chokepoint_weather",
    description: "Fetch real-time weather parameters (temp, wind speed, rain) at Suez Canal, Panama Canal, and major ports.",
    schema: z.object({})
  }
);

const fetchNaturalDisastersTool = tool(
  async () => {
    console.log("[tool] Fetching active natural disaster events from NASA EONET...");
    try {
      const data = await fetchNasaEonetEvents();
      return JSON.stringify(data);
    } catch (error) {
      console.error("[tool] Natural disasters fetch failed:", error.message);
      return `Error fetching active natural disasters: ${error.message}`;
    }
  },
  {
    name: "fetch_natural_disasters",
    description: "Fetch active global natural disasters (storms, wildfires, floods, volcanic activity) from NASA EONET.",
    schema: z.object({})
  }
);

const tools = [fetchNewsTool, fetchWorldBankTool, fetchAlphaVantageTool, fetchUNComtradeTool, fetchChokepointWeatherTool, fetchNaturalDisastersTool];

// --- GRAPH SETUP ---

function createGraphApp() {
  // llama-3.3-70b-versatile: ~30 000 TPM on Groq free tier (vs 6 000 for
  // llama-3.1-8b-instant), and a 128 K context window — avoids 413 errors.
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature: 0,
    maxRetries: 3,
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

// --- HELPER PARSING FUNCTIONS ---

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
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature: 0,
    maxRetries: 3,
  });

  const repairPrompt = [
    "Convert the raw content to strict valid JSON only conforming to the requested schema. Do not output markdown codeblocks.",
    "Target Schema:",
    JSON.stringify(SCHEMA_TEMPLATE, null, 2),
    "Fill missing fields with safe defaults.",
    "Raw input content to parse:",
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

// --- AGENT CLASS & CYCLE RUNNER ---

class SupplyChainEconomiesAgent {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
    }
    this.app = createGraphApp();
  }

  async run() {
    const startTime = new Date().toISOString();
    console.log(`[agent] Cycle started at ${startTime}`);

    try {
      // Wrap the invoke call in the retry helper to handle Groq 429 / 5xx errors.
      const result = await withRetry(() =>
        this.app.invoke({
          messages: [
            new HumanMessage([
              "You are a supply chain and logistics intelligence agent for end users in trade-driven economies.",
              "Use the tools at your disposal to gather the necessary data.",
              "First, fetch news from the Guardian using 'fetch_news'.",
              "Second, fetch macroeconomic indicators using 'fetch_world_bank'.",
              "Third, fetch real-time market indicators using 'fetch_alpha_vantage'.",
              "Fourth, fetch commercial trade statistics from UN Comtrade using 'fetch_un_comtrade'.",
              "Fifth, fetch current weather for global chokepoints using 'fetch_chokepoint_weather'.",
              "Sixth, fetch active natural disasters from NASA EONET using 'fetch_natural_disasters'.",
              "",
              "Correlate the news events with the commodity prices, stocks, forex rates, World Bank indicators, UN Comtrade commercial trade flows, chokepoint weather conditions, and active natural disaster events to construct a structured analysis.",
              "Explain how the market trends, trade statistics, weather delays, and disaster news reinforce or diminish the risks identified in the news.",
              "",
              "Return ONLY a valid JSON object with these top-level keys:",
              "  generated_at, market_snapshot, critical_signals, implications_for_trade_driven_economies, near_term_actions_for_users",
              "",
              "market_snapshot must contain: energy_prices, commodity_indicators, exchange_rates, logistics_and_manufacturing_stocks, macroeconomic_indicators, un_comtrade_trade_flows, chokepoint_weather, active_natural_disasters",
              "",
              "Each critical_signals item must have: headline, published_at, source, url, event_type, why_it_matters, affected_countries, commodities, transport_modes, expected_supply_chain_effects, mitigation_suggestions, risk_score (0-100), risk_level",
              "",
              "Constraints:",
              "- event_type must be exactly one of: PORT_DISRUPTION, LABOR_STRIKE, SHIPPING_DISRUPTION, TRADE_POLICY_CHANGE, SANCTIONS, EXPORT_RESTRICTION, IMPORT_RESTRICTION, ENERGY_SHOCK, CYBER_ATTACK, NATURAL_DISASTER, INFRASTRUCTURE_FAILURE, GEOPOLITICAL_EVENT, OTHER",
              "- risk_level must be exactly one of: LOW, MEDIUM, HIGH, CRITICAL",
              "- transport_modes elements must be subset of: Ocean, Air, Rail, Road, Pipeline",
              "- why_it_matters must be concise and action-oriented",
              "- Return ONLY valid JSON. No markdown fences, prologues, or explanation wrappers."
            ].join("\n")),
          ],
        })
      );

      const rawContent = getFinalModelText(result);
      let structured;
      try {
        structured = parseJsonLoose(rawContent);
      } catch {
        console.warn("[agent] Direct JSON parse failed, triggering repair loop...");
        structured = await coerceStructuredJson(rawContent);
      }

      console.log("\n[agent] Structured Analysis Output:");
      console.log(JSON.stringify(structured, null, 2));

      // Persist the report if there are critical signals
      if (structured?.critical_signals?.length > 0) {
        console.log(`[agent] Found ${structured.critical_signals.length} critical signals. Persisting to database...`);
        await persistSupplyChainReport(structured);
        console.log("[agent] Persisted successfully.");
      } else {
        console.log("[agent] No critical signals found in report; skipping DB persistence.");
      }

      await this.appendLog({
        timestamp: startTime,
        status: "success",
        signalsCount: structured?.critical_signals?.length || 0,
      });

      return structured;
    } catch (error) {
      console.error("[agent] Cycle failed:", error.message);
      await this.appendLog({
        timestamp: startTime,
        status: "error",
        error: error.message,
      });
      throw error;
    }
  }

  async appendLog(entry) {
    try {
      await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
      await fs.appendFile(LOG_FILE_PATH, `${JSON.stringify(entry)}\n`, "utf8");
    } catch (err) {
      console.error("[agent] Logging failed:", err.message);
    }
  }
}

// Executable CLI support
if (process.argv[1] && (process.argv[1].endsWith("supply_chain_economies_agent.js") || process.argv.includes("--run"))) {
  const agent = new SupplyChainEconomiesAgent();
  agent.run()
    .then(() => {
      console.log("[agent] Runner completed execution successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[agent] Runner failed with fatal error:", error.message);
      process.exit(1);
    });
}

export { SupplyChainEconomiesAgent };
