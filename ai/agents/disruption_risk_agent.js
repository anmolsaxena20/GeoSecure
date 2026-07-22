import crypto from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = crypto;
}

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Import DB operations
import { pool } from "../db/db.js";

// Import config LLM
import { llm } from "../configs/llm.js";

// Import services
import { fetchGuardianNews } from "../services/guardianService.js";
import { fetchCommodities, fetchForex, fetchStocks } from "../services/alphaVantageService.js";
import { fetchChokepointWeather, fetchNasaEonetEvents } from "../services/weatherDisasterService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const LOG_FILE_PATH = path.resolve(__dirname, "../logs/disruption_risk_agent.log");

// Schema representing the structured output for corridors and commodities
const SCHEMA_TEMPLATE = {
  corridors: [
    {
      corridor_name: "",
      disruption_probability: 0,
      risk_level: "LOW" // LOW, MEDIUM, HIGH, CRITICAL
    }
  ],
  commodities: [
    {
      commodity: "",
      disruption_probability: 0,
      risk_level: "LOW" // LOW, MEDIUM, HIGH, CRITICAL
    }
  ]
};

// Trim commodity data helper
function trimCommodityData(rawCommodities) {
  const trimmed = {};
  for (const [key, val] of Object.entries(rawCommodities || {})) {
    if (val && Array.isArray(val.data)) {
      trimmed[key] = {
        name: val.name,
        unit: val.unit,
        data: val.data.slice(0, 2)
      };
    } else {
      trimmed[key] = val;
    }
  }
  return trimmed;
}

// --- DATABASE FUNCTIONS ---

async function ensureTablesExist() {
  console.log("[db] Ensuring tables exist...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS corridor_risk_scores (
        id SERIAL PRIMARY KEY,
        corridor_name VARCHAR(100) UNIQUE,
        disruption_probability INTEGER,
        risk_level VARCHAR(20),
        updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS commodity_risk_scores (
        id SERIAL PRIMARY KEY,
        commodity VARCHAR(50) UNIQUE,
        disruption_probability INTEGER,
        risk_level VARCHAR(20),
        updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("[db] Tables verified/created.");
}

async function persistScores(structuredData) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Save corridors
    if (Array.isArray(structuredData.corridors)) {
      for (const c of structuredData.corridors) {
        if (!c.corridor_name) continue;
        await client.query(`
          INSERT INTO corridor_risk_scores (corridor_name, disruption_probability, risk_level, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (corridor_name)
          DO UPDATE SET 
            disruption_probability = EXCLUDED.disruption_probability,
            risk_level = EXCLUDED.risk_level,
            updated_at = NOW()
        `, [c.corridor_name, c.disruption_probability || 0, c.risk_level || "LOW"]);
      }
      console.log(`[db] Persisted ${structuredData.corridors.length} corridor risk scores.`);
    }

    // Save commodities
    if (Array.isArray(structuredData.commodities)) {
      for (const cmd of structuredData.commodities) {
        if (!cmd.commodity) continue;
        await client.query(`
          INSERT INTO commodity_risk_scores (commodity, disruption_probability, risk_level, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (commodity)
          DO UPDATE SET 
            disruption_probability = EXCLUDED.disruption_probability,
            risk_level = EXCLUDED.risk_level,
            updated_at = NOW()
        `, [cmd.commodity, cmd.disruption_probability || 0, cmd.risk_level || "LOW"]);
      }
      console.log(`[db] Persisted ${structuredData.commodities.length} commodity risk scores.`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[db] Error persisting risk scores:", err.message);
    throw err;
  } finally {
    client.release();
  }
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

const tools = [fetchNewsTool, fetchAlphaVantageTool, fetchChokepointWeatherTool, fetchNaturalDisastersTool];

// --- GRAPH SETUP ---

function createGraphApp() {
  const model = llm.bindTools(tools);
  const toolNode = new ToolNode(tools);

  async function callModel(state) {
    const response = await model.invoke(state.messages);
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
  const repairPrompt = [
    "Convert the raw content to strict valid JSON only conforming to the requested schema. Do not output markdown codeblocks.",
    "Target Schema:",
    JSON.stringify(SCHEMA_TEMPLATE, null, 2),
    "Fill missing fields with safe defaults.",
    "Raw input content to parse:",
    String(rawText || ""),
  ].join("\n");

  const response = await llm.invoke([
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

class DisruptionRiskAgent {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
    }
    this.app = createGraphApp();
  }

  async run() {
    const startTime = new Date().toISOString();
    console.log(`[agent] Disruption Risk Agent Cycle started at ${startTime}`);

    // Ensure database tables exist
    await ensureTablesExist();

    try {
      const result = await this.app.invoke({
        messages: [
          new HumanMessage([
            "You are an advanced supply chain intelligence agent assessing disruption risks for key trade corridors and commodities.",
            "Use the tools at your disposal to gather the necessary data.",
            "First, fetch news from the Guardian using 'fetch_news'.",
            "Second, fetch weather at major chokepoints using 'fetch_chokepoint_weather'.",
            "Third, fetch active natural disasters using 'fetch_natural_disasters'.",
            "Fourth, fetch real-time market indicators and commodities using 'fetch_alpha_vantage'.",
            "",
            "Analyze all gathered data and assess the live disruption probability score (0 to 100) and risk level (LOW, MEDIUM, HIGH, CRITICAL) for each of the following target trade corridors and commodities:",
            "",
            "Target Corridors:",
            "- Suez Canal",
            "- Panama Canal",
            "- Strait of Hormuz",
            "- Strait of Malacca",
            "- Port of Singapore",
            "- Port of Rotterdam",
            "- Port of Shanghai",
            "- US West Coast Ports",
            "- US East Coast Ports",
            "- Black Sea Route",
            "",
            "Target Commodities:",
            "- Brent Crude",
            "- WTI Crude",
            "- Natural Gas",
            "- Copper",
            "- Wheat",
            "- Semiconductors",
            "- Pharmaceuticals",
            "- Iron Ore",
            "",
            "Return ONLY a valid JSON payload matching this exact schema layout:",
            JSON.stringify(SCHEMA_TEMPLATE, null, 2),
            "",
            "Constraints:",
            "- risk_level must be exactly one of: LOW, MEDIUM, HIGH, CRITICAL",
            "- disruption_probability must be an integer between 0 and 100",
            "- Return ONLY valid JSON. No conversational prologues, epilogues, or explanation wrappers."
          ].join("\n")),
        ],
      });

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

      // Persist the scores
      await persistScores(structured);

      await this.appendLog({
        timestamp: startTime,
        status: "success",
        corridorsCount: structured?.corridors?.length || 0,
        commoditiesCount: structured?.commodities?.length || 0,
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
if (process.argv[1] && (process.argv[1].endsWith("disruption_risk_agent.js") || process.argv.includes("--run"))) {
  const agent = new DisruptionRiskAgent();
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

export { DisruptionRiskAgent };
