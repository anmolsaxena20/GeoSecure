import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { seaRoute } from "searoute-ts";

// Import DB operations
import { pool } from "../db/db.js";

import { ChatGroq } from "@langchain/groq";

// --- MODEL FALLBACK CHAIN ---
// When one model's daily quota is exhausted, automatically switch to the next
const MODEL_CHAIN = [
  "llama-3.3-70b-versatile",       // Primary: best quality
  "llama-3.1-70b-versatile",       // Fallback 1: secondary high-quality
  "llama-3.1-8b-instant",          // Fallback 2: fast, but prone to loops
];

let currentModelIndex = 0;

function createLlm(modelName) {
  console.log(`[agent] Using model: ${modelName}`);
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: modelName,
    temperature: 0.3,
    maxRetries: 2
  });
}

let orchestratorLlm = createLlm(MODEL_CHAIN[currentModelIndex]);

function switchToNextModel() {
  currentModelIndex++;
  if (currentModelIndex >= MODEL_CHAIN.length) {
    console.error("[agent] All models exhausted. No fallback available.");
    return false;
  }
  const nextModel = MODEL_CHAIN[currentModelIndex];
  console.warn(`[agent] Switching to fallback model: ${nextModel}`);
  orchestratorLlm = createLlm(nextModel);
  return true;
}

// Import helper services
import { fetchUNComtradeData } from "../services/unComtradeService.js";
import { fetchGuardianNews } from "../services/guardianService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const LOG_FILE_PATH = path.resolve(__dirname, "../logs/adaptive_procurement_orchestrator.log");

// Target schema template for structured JSON recommendations output
const SCHEMA_TEMPLATE = {
  recommendations: [
    {
      commodity: "",
      current_source: "",
      recommended_source: "",
      route_type: "Sea", // Sea, Road, Rail, Air, Pipeline
      distance_km: 0,
      duration_hours: 0,
      transit_days: 0, // Estimated transit days
      cost_usd: 0,
      cost_local: 0,
      currency: "INR",
      logistics_performance_index: 0,
      urgency: "HIGH", // LOW, MEDIUM, HIGH, CRITICAL
      recommendation_summary: "",
      rationale: "",
      confidence_score_percent: 0, // Confidence score as integer percentage (0-100)
      procurement_score_percent: 0, // Procurement score as integer percentage (0-100)
      top_ranked_alternatives: [
        {
          name: "",
          score_percent: 0,
          rank: 1
        }
      ], // 3 to 5 ranked alternatives with score percentages
      risk_breakdown: {
        disruption_probability_percent: 0,
        geopolitical_risk_score: 0,
        weather_risk_score: 0,
        congestion_risk_score: 0,
        overall_risk_score: 0
      }, // Detailed risk breakdown
      eta: "", // Estimated arrival date/time descriptor
      cost_comparison: {
        base_cost_usd: 0,
        freight_cost_usd: 0,
        customs_tariffs_usd: 0,
        total_landed_cost_usd: 0,
        total_cost_local: 0,
        savings_or_premium_usd: 0
      }, // Detailed cost breakdown
      decision_factors: [
        {
          factor: "",
          description: ""
        }
      ], // Descriptive decision factors
      trigger_event: "Standard Supply Chain Optimisation Check", // Neutral trigger event
      supplier_reliability: "HIGH", // HIGH, MEDIUM, LOW
      refinery_compatibility: "COMPATIBLE", // COMPATIBLE, MINOR_ADJUSTMENTS, INCOMPATIBLE
      route_health_score: 0, // Overall route health (0-100)
      data_sources_used: [], // Sources, e.g. ["The Guardian", "World Bank", "UN Comtrade", "ArcGIS"]
      next_recommended_action: "", // Actions to act on immediately
      supplier_details: {
        supplier_name: "",
        country: "",
        lpi_score: 0,
        harbor_size: "",
        harbor_type: ""
      }, // Supplier profile details
      weighted_scoring: {
        logistics_weight: 0.4,
        cost_weight: 0.3,
        risk_weight: 0.3,
        calculated_overall_score: 0
      }, // Weighted scoring model
      timestamp: "" // Analysis timestamp (ISO format)
    }
  ]
};

// --- DATABASE FUNCTIONS ---

async function ensureTablesExist() {
  console.log("[db] Ensuring procurement tables exist...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_recommendations (
        id SERIAL PRIMARY KEY,
        commodity VARCHAR(100),
        current_source VARCHAR(100),
        alternative_source VARCHAR(100),
        route_type VARCHAR(20),
        distance_km NUMERIC,
        duration_hours NUMERIC,
        transit_days NUMERIC,
        cost_usd NUMERIC,
        cost_local NUMERIC,
        currency VARCHAR(10),
        logistics_performance_index NUMERIC,
        urgency VARCHAR(20),
        recommendation_summary TEXT,
        rationale TEXT,
        confidence_score NUMERIC,
        procurement_score NUMERIC,
        top_ranked_alternatives JSONB,
        risk_breakdown JSONB,
        eta VARCHAR(100),
        cost_comparison JSONB,
        decision_factors JSONB,
        trigger_event TEXT,
        supplier_reliability VARCHAR(50),
        refinery_compatibility TEXT,
        route_health_score NUMERIC,
        data_sources_used JSONB,
        next_recommended_action TEXT,
        supplier_details JSONB,
        weighted_scoring JSONB,
        analysis_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("[db] Procurement tables verified/created.");
}

async function persistRecommendations(structuredData) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (Array.isArray(structuredData.recommendations)) {
      for (const rec of structuredData.recommendations) {
        if (!rec.commodity) continue;
        await client.query(`
          INSERT INTO procurement_recommendations (
            commodity, current_source, alternative_source, route_type,
            distance_km, duration_hours, transit_days, cost_usd, cost_local, currency,
            logistics_performance_index, urgency, recommendation_summary, rationale,
            confidence_score, procurement_score, top_ranked_alternatives, risk_breakdown,
            eta, cost_comparison, decision_factors, trigger_event,
            supplier_reliability, refinery_compatibility, route_health_score,
            data_sources_used, next_recommended_action, supplier_details, weighted_scoring,
            analysis_timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
        `, [
          rec.commodity,
          rec.current_source,
          rec.alternative_source || rec.recommended_source,
          rec.route_type || "Sea",
          rec.distance_km ? Number(rec.distance_km) : null,
          rec.duration_hours ? Number(rec.duration_hours) : null,
          rec.transit_days ? Number(rec.transit_days) : null,
          rec.cost_usd ? Number(rec.cost_usd) : null,
          rec.cost_local ? Number(rec.cost_local) : null,
          rec.currency || "INR",
          rec.logistics_performance_index ? Number(rec.logistics_performance_index) : null,
          rec.urgency || "MEDIUM",
          rec.recommendation_summary,
          rec.rationale,
          rec.confidence_score_percent ? Number(rec.confidence_score_percent) : null,
          rec.procurement_score_percent ? Number(rec.procurement_score_percent) : null,
          JSON.stringify(rec.top_ranked_alternatives || []),
          JSON.stringify(rec.risk_breakdown || {}),
          rec.eta,
          JSON.stringify(rec.cost_comparison || {}),
          JSON.stringify(rec.decision_factors || []),
          rec.trigger_event || "Standard Supply Chain Optimisation Check",
          rec.supplier_reliability,
          rec.refinery_compatibility,
          rec.route_health_score ? Number(rec.route_health_score) : null,
          JSON.stringify(rec.data_sources_used || []),
          rec.next_recommended_action,
          JSON.stringify(rec.supplier_details || {}),
          JSON.stringify(rec.weighted_scoring || {}),
          rec.timestamp || new Date().toISOString()
        ]);
      }
      console.log(`[db] Persisted ${structuredData.recommendations.length} procurement recommendations.`);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[db] Error persisting procurement recommendations:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

// --- TOOL DEFINITIONS ---

const fetchNewsTool = tool(
  async () => {
    console.log("[tool] Fetching current supply chain/logistics news...");
    try {
      const news = await fetchGuardianNews();
      return JSON.stringify(news);
    } catch (error) {
      console.error("[tool] News fetch failed:", error.message);
      return `Error fetching current news: ${error.message}`;
    }
  },
  {
    name: "fetch_news",
    description: "Fetch latest supply chain, shipping, logistics, and sanctions news from the Guardian API.",
    schema: z.object({})
  }
);

const fetchDisruptionRisksTool = tool(
  async () => {
    console.log("[tool] Fetching active disruption risks from database...");
    try {
      const corridors = await pool.query(
        "SELECT corridor_name, disruption_probability, risk_level FROM corridor_risk_scores WHERE disruption_probability > 0 OR risk_level IN ('MEDIUM', 'HIGH', 'CRITICAL')"
      );
      const commodities = await pool.query(
        "SELECT commodity, disruption_probability, risk_level FROM commodity_risk_scores WHERE disruption_probability > 0 OR risk_level IN ('MEDIUM', 'HIGH', 'CRITICAL')"
      );
      const recentEvents = await pool.query(
        "SELECT event_type, summary, countries, commodities, risk_level, risk_score FROM events ORDER BY id DESC LIMIT 10"
      );
      return JSON.stringify({
        active_corridor_risks: corridors.rows,
        active_commodity_risks: commodities.rows,
        recent_disruption_events: recentEvents.rows
      });
    } catch (error) {
      console.error("[tool] Failed to fetch active disruption risks:", error.message);
      return `Error fetching active disruption risks: ${error.message}`;
    }
  },
  {
    name: "fetch_disruption_risks",
    description: "Fetch active supply chain disruption risks for corridors, commodities, and recent events from the database.",
    schema: z.object({})
  }
);

const searchPortsTool = tool(
  async ({ portName }) => {
    console.log(`[tool] Searching ports by name: ${portName}`);
    try {
      const url = `https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/World_Port_Index/FeatureServer/0/query?where=UPPER(PORT_NAME)%20LIKE%20UPPER('%25${encodeURIComponent(portName)}%25')&outFields=*&f=json`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        return `No ports found for search query: ${portName}`;
      }
      const ports = data.features.map(f => ({
        port_name: f.attributes.PORT_NAME,
        country: f.attributes.COUNTRY,
        latitude: f.attributes.LATITUDE,
        longitude: f.attributes.LONGITUDE,
        harbor_size: f.attributes.HARBORSIZE,
        harbor_type: f.attributes.HARBORTYPE,
        provisions: f.attributes.PROVISIONS,
        water: f.attributes.WATER,
        fuel_oil: f.attributes.FUEL_OIL,
        diesel: f.attributes.DIESEL
      }));
      return JSON.stringify(ports.slice(0, 5));
    } catch (error) {
      console.error("[tool] Port search failed:", error.message);
      return `Error searching ports: ${error.message}`;
    }
  },
  {
    name: "search_ports",
    description: "Search the World Port Index by port name. Returns port characteristics, size, type, facilities, and coordinates.",
    schema: z.object({
      portName: z.string().describe("Name of the port (e.g. 'Singapore', 'Rotterdam')")
    })
  }
);

const geocodeLocationTool = tool(
  async ({ query }) => {
    console.log(`[tool] Geocoding location: ${query}`);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "SupplyChainAgent"
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (!data || data.length === 0) {
        return `No coordinates found for location: ${query}`;
      }
      const result = {
        name: data[0].display_name,
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
      return JSON.stringify(result);
    } catch (error) {
      console.error("[tool] Geocoding failed:", error.message);
      return `Error geocoding location: ${error.message}`;
    }
  },
  {
    name: "geocode_location",
    description: "Convert a supplier, city, or port name into geographic coordinates (latitude and longitude).",
    schema: z.object({
      query: z.string().describe("Supplier name, city, or port name (e.g. 'Port of Singapore', 'Delhi')")
    })
  }
);

const calculateSeaRouteTool = tool(
  async ({ startLon, startLat, endLon, endLat, speedKnots }) => {
    console.log(`[tool] Calculating sea route from [${startLon}, ${startLat}] to [${endLon}, ${endLat}]`);
    const speed = speedKnots || 15;
    try {
      const route = seaRoute([Number(startLon), Number(startLat)], [Number(endLon), Number(endLat)]);
      if (!route || !route.properties) {
        return "Could not calculate sea route between specified points.";
      }
      const nauticalMiles = route.properties.length;
      const distanceKm = nauticalMiles * 1.852;
      const durationHours = nauticalMiles / speed;
      return JSON.stringify({
        distance_nautical_miles: nauticalMiles,
        distance_km: distanceKm,
        estimated_duration_hours: durationHours,
        average_speed_knots: speed
      });
    } catch (error) {
      console.error("[tool] Sea route calculation failed:", error.message);
      return `Error calculating sea route: ${error.message}`;
    }
  },
  {
    name: "calculate_sea_route",
    description: "Calculate maritime shipping distance (in nautical miles and km) and estimate duration (in hours) between two coordinates.",
    schema: z.object({
      startLon: z.number().describe("Longitude of the origin coordinates"),
      startLat: z.number().describe("Latitude of the origin coordinates"),
      endLon: z.number().describe("Longitude of the destination coordinates"),
      endLat: z.number().describe("Latitude of the destination coordinates"),
      speedKnots: z.number().optional().describe("Average cargo ship speed in knots (defaults to 15)")
    })
  }
);

const calculateRoadRouteTool = tool(
  async ({ startLon, startLat, endLon, endLat }) => {
    console.log(`[tool] Calculating road route from [${startLon}, ${startLat}] to [${endLon}, ${endLat}]`);
    const apiKey = process.env.ORS_API_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijk2MDQ0NDE3YmRjNTQzNjk5YzU0YzUxNGNhNGMxMTZjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://api.openrouteservice.org/v2/directions/driving-car";
    const body = {
      coordinates: [
        [Number(startLon), Number(startLat)],
        [Number(endLon), Number(endLat)]
      ]
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok || !data.routes || data.routes.length === 0) {
        return `Road routing failed: ${JSON.stringify(data)}`;
      }
      const summary = data.routes[0].summary;
      return JSON.stringify({
        distance_km: summary.distance / 1000,
        duration_hours: summary.duration / 3600
      });
    } catch (error) {
      console.error("[tool] Road route calculation failed:", error.message);
      return `Error calculating road route: ${error.message}`;
    }
  },
  {
    name: "calculate_road_route",
    description: "Calculate land driving distance (in km) and duration (in hours) between two coordinates using OpenRouteService.",
    schema: z.object({
      startLon: z.number().describe("Longitude of the origin coordinates"),
      startLat: z.number().describe("Latitude of the origin coordinates"),
      endLon: z.number().describe("Longitude of the destination coordinates"),
      endLat: z.number().describe("Latitude of the destination coordinates")
    })
  }
);

const convertCurrencyTool = tool(
  async ({ fromCurrency, toCurrency }) => {
    const from = fromCurrency || "USD";
    const to = toCurrency || "INR";
    console.log(`[tool] Fetching currency rate from ${from} to ${to}`);
    try {
      const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (!data.rates || !data.rates[to]) {
        return `Exchange rate not available for: ${to}`;
      }
      return JSON.stringify({
        from_currency: from,
        to_currency: to,
        rate: data.rates[to],
        date: data.date
      });
    } catch (error) {
      console.error("[tool] Currency exchange fetch failed:", error.message);
      return `Error fetching exchange rate: ${error.message}`;
    }
  },
  {
    name: "convert_currency",
    description: "Get real-time currency exchange rates (e.g., from USD to INR) using the Frankfurter API.",
    schema: z.object({
      fromCurrency: z.string().optional().describe("Source currency code (e.g. 'USD')"),
      toCurrency: z.string().optional().describe("Target currency code (e.g. 'INR')")
    })
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
    description: "Fetch global commercial imports/exports trade flow volume and values from the UN Comtrade API. Use this to check trade volumes for ANY commodity sector.",
    schema: z.object({
      reporterCode: z.string().optional().describe("UN M49 code of reporting country (e.g., '356' for India, '51' for Armenia, 'all')"),
      partnerCode: z.string().optional().describe("UN M49 code of partner country (e.g. '0' for World)"),
      period: z.string().optional().describe("Year of reporting (e.g. '2025' or '2024')"),
      flowCode: z.string().optional().describe("'M' for Imports, 'X' for Exports"),
      cmdCode: z.string().optional().describe("HS commodity code — pick based on context, e.g. 'TOTAL' for all, '27' for mineral fuels/oil, '72' for iron/steel, '84' for machinery, '85' for electrical equipment, '30' for pharmaceuticals, '87' for vehicles, '39' for plastics, '10' for cereals")
    })
  }
);

const fetchLogisticsPerformanceTool = tool(
  async ({ countryCode }) => {
    const code = countryCode || "IND";
    console.log(`[tool] Fetching logistics performance index (LPI) for ${code}`);
    try {
      const url = `https://api.worldbank.org/v2/country/${code}/indicator/LP.LPI.OVRL.XQ?format=json`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (!data || data.length < 2 || !data[1] || data[1].length === 0) {
        return `Logistics performance index not found for country: ${code}`;
      }
      return JSON.stringify({
        country: code,
        indicator: data[1][0].indicator?.value,
        lpi_score: data[1][0].value,
        year: data[1][0].date
      });
    } catch (error) {
      console.error("[tool] LPI fetch failed:", error.message);
      return `Error fetching logistics performance index: ${error.message}`;
    }
  },
  {
    name: "fetch_logistics_performance",
    description: "Fetch the logistics performance index (LPI) from the World Bank for a specific country to rank procurement destinations.",
    schema: z.object({
      countryCode: z.string().describe("ISO country code (e.g., 'IND', 'DEU', 'SGP')")
    })
  }
);

// Analysis tools only — news and disruption risks are pre-fetched deterministically
const analysisTools = [
  searchPortsTool,
  geocodeLocationTool,
  calculateSeaRouteTool,
  calculateRoadRouteTool,
  convertCurrencyTool,
  fetchUNComtradeTool,
  fetchLogisticsPerformanceTool
];

// --- GRAPH SETUP ---

function createGraphApp() {
  const model = orchestratorLlm.bindTools(analysisTools);
  const toolNode = new ToolNode(analysisTools);

  async function callModel(state) {
    const response = await invokeWithRetry(() => model.invoke(state.messages));
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
    .compile({ recursionLimit: 8 });
}

// Rebuild graph with current model (needed after model switch)
function rebuildGraph() {
  return createGraphApp();
}

// --- RETRY HELPERS ---

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error) {
  const msg = String(error?.message || "");
  return (
    msg.includes("429") ||
    msg.includes("rate_limit_exceeded") ||
    msg.includes("tokens per minute") ||
    msg.includes("Rate limit reached") ||
    msg.includes("tool_use_failed") ||
    msg.includes("Failed to call a function")
  );
}

function isDailyLimitError(error) {
  const msg = String(error?.message || "");
  return msg.includes("tokens per day") || msg.includes("TPD");
}

function isModelDecommissionedError(error) {
  const msg = String(error?.message || "");
  return msg.includes("decommissioned") || msg.includes("does not exist") || error?.status === 400 || error?.status === 404;
}

async function invokeWithRetry(fn, maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Daily limit or decommissioned model: switch model immediately
      if (isDailyLimitError(error) || isModelDecommissionedError(error)) {
        console.warn(`[agent] Model unavailable (Limit or Decommissioned): ${error.message}`);
        const switched = switchToNextModel();
        if (!switched) throw error; // no more fallbacks
        throw Object.assign(new Error("MODEL_SWITCHED"), { modelSwitched: true });
      }
      // Per-minute limit: retry with backoff, or switch model if max retries hit
      if (!isRateLimitError(error)) throw error;
      if (attempt === maxAttempts) {
        console.warn(`[agent] Max retries reached for TPM rate limit.`);
        const switched = switchToNextModel();
        if (!switched) throw error; // no more fallbacks
        throw Object.assign(new Error("MODEL_SWITCHED"), { modelSwitched: true });
      }
      const waitMs = Math.min(30000, 2000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 1000);
      console.warn(`[agent] Rate limit hit. Retry ${attempt}/${maxAttempts} in ${waitMs}ms...`);
      await sleep(waitMs);
    }
  }
}

// --- PRE-FETCH FUNCTIONS (deterministic, not LLM-dependent) ---

async function prefetchNews() {
  console.log("[prefetch] Fetching current supply chain news...");
  try {
    const news = await fetchGuardianNews();
    console.log(`[prefetch] Received ${Array.isArray(news) ? news.length : 0} news articles.`);
    return news;
  } catch (error) {
    console.error("[prefetch] News fetch failed:", error.message);
    return [];
  }
}

async function prefetchDisruptionRisks() {
  console.log("[prefetch] Fetching disruption risks from database...");
  try {
    const corridors = await pool.query(
      "SELECT corridor_name, disruption_probability, risk_level FROM corridor_risk_scores WHERE disruption_probability > 0 OR risk_level IN ('MEDIUM', 'HIGH', 'CRITICAL')"
    );
    const commodities = await pool.query(
      "SELECT commodity, disruption_probability, risk_level FROM commodity_risk_scores WHERE disruption_probability > 0 OR risk_level IN ('MEDIUM', 'HIGH', 'CRITICAL')"
    );
    const recentEvents = await pool.query(
      "SELECT event_type, summary, countries, commodities, risk_level, risk_score FROM events ORDER BY id DESC LIMIT 10"
    );
    const result = {
      active_corridor_risks: corridors.rows,
      active_commodity_risks: commodities.rows,
      recent_disruption_events: recentEvents.rows
    };
    console.log(`[prefetch] Found ${corridors.rows.length} corridor risks, ${commodities.rows.length} commodity risks, ${recentEvents.rows.length} recent events.`);
    return result;
  } catch (error) {
    console.error("[prefetch] Disruption risks fetch failed:", error.message);
    return { active_corridor_risks: [], active_commodity_risks: [], recent_disruption_events: [] };
  }
}

// --- HELPER PARSING FUNCTIONS ---

function parseJsonLoose(text) {
  const raw = String(text ?? "").trim();

  // 1. Direct parse
  try {
    return JSON.parse(raw);
  } catch { }

  // 2. Strip markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { }
  }

  // 3. Bracket-depth matching: find the complete top-level JSON object
  const objectStart = raw.indexOf("{");
  if (objectStart >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = objectStart; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = raw.slice(objectStart, i + 1);
          try { return JSON.parse(candidate); } catch { }
          // Try fixing trailing commas before closing braces/brackets
          const fixed = candidate
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");
          try { return JSON.parse(fixed); } catch { }
          break;
        }
      }
    }
  }

  // 4. Fallback: first { to last }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = raw.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(slice); } catch { }
    // Fix trailing commas
    const fixed = slice.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try { return JSON.parse(fixed); } catch { }
  }

  throw new Error("No valid JSON found in model output.");
}

// Normalize: if LLM returns bare array or single object, wrap into {recommendations: [...]}
function normalizeStructured(parsed) {
  if (Array.isArray(parsed)) {
    return { recommendations: parsed };
  }
  if (parsed && !parsed.recommendations && typeof parsed === "object") {
    // Check if it's a single recommendation object
    if (parsed.commodity && parsed.recommended_source) {
      return { recommendations: [parsed] };
    }
    // Check if any key contains an array of recommendation-like objects
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0 && parsed[key][0].commodity) {
        return { recommendations: parsed[key] };
      }
    }
  }
  return parsed;
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

  const response = await invokeWithRetry(() => orchestratorLlm.invoke([
    { role: "system", content: "You are a strict JSON formatter." },
    { role: "user", content: repairPrompt },
  ]));

  const text = typeof response.content === "string"
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("\n")
      : String(response.content || "");

  return parseJsonLoose(text);
}

// --- POST-PROCESSING: Compute dynamic values from data ---

function postProcessRecommendations(recommendations, assignedCommodities) {
  const riskOrderMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  for (const rec of recommendations) {
    // --- Route Type ---
    // If distance < 3000km, consider Road; pipelines for crude oil/gas
    const commodity = (rec.commodity || "").toLowerCase();
    if (commodity.includes("crude") || commodity.includes("natural gas") || commodity.includes("fuel")) {
      if (rec.distance_km && rec.distance_km < 5000) {
        rec.route_type = "Pipeline";
      } else {
        rec.route_type = "Sea";
      }
    } else if (rec.distance_km && rec.distance_km < 2000) {
      rec.route_type = "Road";
    } else if (rec.distance_km && rec.distance_km < 1000) {
      rec.route_type = "Rail";
    } else {
      rec.route_type = rec.route_type || "Sea";
    }

    // --- Urgency: derive from assigned commodity risk level ---
    const matched = assignedCommodities.find(ac =>
      rec.commodity && rec.commodity.toLowerCase().includes(ac.commodity.toLowerCase())
    );
    if (matched) {
      rec.urgency = matched.riskLevel; // CRITICAL, HIGH, MEDIUM, LOW from actual DB
    }

    // --- LPI: ensure it's not null ---
    if (!rec.logistics_performance_index && rec.supplier_details?.lpi_score) {
      rec.logistics_performance_index = rec.supplier_details.lpi_score;
    }
    if (!rec.logistics_performance_index) {
      // Estimate from country (common LPI values)
      const lpiEstimates = {
        "germany": 4.2, "singapore": 4.0, "usa": 3.9, "china": 3.6,
        "japan": 4.0, "south korea": 3.7, "india": 3.2, "uae": 3.5,
        "australia": 3.8, "brazil": 2.9, "russia": 2.8
      };
      const country = (rec.recommended_source || "").toLowerCase();
      rec.logistics_performance_index = lpiEstimates[country] || 3.0;
    }
    // Sync supplier_details.lpi_score
    if (rec.supplier_details) {
      rec.supplier_details.lpi_score = rec.logistics_performance_index;
    }

    // --- Supplier Reliability: derive from LPI score ---
    if (rec.logistics_performance_index >= 3.8) {
      rec.supplier_reliability = "HIGH";
    } else if (rec.logistics_performance_index >= 3.0) {
      rec.supplier_reliability = "MEDIUM";
    } else {
      rec.supplier_reliability = "LOW";
    }

    // --- Route Health Score: compute from risk + distance ---
    const overallRisk = rec.risk_breakdown?.overall_risk_score || 20;
    const distancePenalty = rec.distance_km ? Math.min(20, rec.distance_km / 1000) : 10;
    rec.route_health_score = Math.max(10, Math.min(100, Math.round(100 - overallRisk - distancePenalty)));

    // --- Confidence Score: based on data completeness ---
    let dataPoints = 0;
    if (rec.distance_km && rec.distance_km > 0) dataPoints += 2;
    if (rec.logistics_performance_index) dataPoints += 2;
    if (rec.cost_usd && rec.cost_usd > 0) dataPoints += 1;
    if (rec.risk_breakdown?.overall_risk_score) dataPoints += 1;
    if (rec.cost_local && rec.cost_local > 0) dataPoints += 1;
    if (rec.duration_hours && rec.duration_hours > 0) dataPoints += 1;
    rec.confidence_score_percent = Math.min(95, 45 + dataPoints * 7);

    // --- Weighted Scoring: calculate from actual values ---
    if (rec.weighted_scoring !== undefined) {
      if (typeof rec.weighted_scoring !== "object" || rec.weighted_scoring === null) {
        rec.weighted_scoring = { logistics_weight: 0.4, cost_weight: 0.3, risk_weight: 0.3 };
      }
      
      const lpiNorm = (rec.logistics_performance_index / 5) * 100;
      const costNorm = rec.cost_usd ? Math.max(20, Math.min(100, 100 - Math.log10(rec.cost_usd) * 10)) : 50;
      const riskNorm = Math.max(0, 100 - (overallRisk * 2.5));

      const lw = rec.weighted_scoring.logistics_weight || 0.4;
      const cw = rec.weighted_scoring.cost_weight || 0.3;
      const rw = rec.weighted_scoring.risk_weight || 0.3;
      rec.weighted_scoring.calculated_overall_score = Math.round(
        lpiNorm * lw + costNorm * cw + riskNorm * rw
      );
    }

    // --- Procurement Score: derived from weighted score + confidence ---
    const ws = rec.weighted_scoring?.calculated_overall_score || 50;
    rec.procurement_score_percent = Math.round(ws * 0.6 + rec.confidence_score_percent * 0.4);

    // --- Transit Days: compute from duration_hours if not set ---
    if (rec.duration_hours && (!rec.transit_days || rec.transit_days === 0)) {
      rec.transit_days = Math.ceil(rec.duration_hours / 24);
    }

    // --- ETA: compute actual date ---
    if (rec.transit_days) {
      const etaDate = new Date();
      etaDate.setDate(etaDate.getDate() + rec.transit_days);
      rec.eta = `${rec.transit_days} days (est. ${etaDate.toISOString().split('T')[0]})`;
    }

    // --- Data Sources Used: ensure populated ---
    if (!rec.data_sources_used || rec.data_sources_used.length === 0) {
      rec.data_sources_used = ["The Guardian", "World Bank LPI", "UN Comtrade", "ArcGIS World Port Index", "OpenRouteService"];
    }

    // --- Refinery Compatibility: vary by commodity type ---
    if (commodity.includes("crude") || commodity.includes("fuel")) {
      rec.refinery_compatibility = "COMPATIBLE";
    } else if (commodity.includes("ore")) {
      rec.refinery_compatibility = "MINOR_ADJUSTMENTS";
    } else {
      rec.refinery_compatibility = "N/A";
    }
  }

  return recommendations;
}

// --- AGENT CLASS & CYCLE RUNNER ---

class AdaptiveProcurementOrchestrator {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
    }
    this.app = createGraphApp();
  }

  async run() {
    const startTime = new Date().toISOString();
    console.log(`[agent] Adaptive Procurement Orchestrator Cycle started at ${startTime}`);

    // Ensure database tables exist
    await ensureTablesExist();

    // =====================================================
    // PHASE 1: Deterministic data gathering (NOT LLM-driven)
    // Pre-fetch news and disruption risks so the LLM cannot skip them
    // =====================================================
    const [newsData, riskData] = await Promise.all([
      prefetchNews(),
      prefetchDisruptionRisks()
    ]);

    // Summarize the pre-fetched data for the prompt
    const newsHeadlines = Array.isArray(newsData) && newsData.length > 0
      ? newsData.slice(0, 2).map((a, i) => `  ${i + 1}. "${a.webTitle || a.title || 'No title'}" (${a.sectionName || 'general'})`).join("\n")
      : "  No news data available.";

    const corridorRisks = riskData.active_corridor_risks.length > 0
      ? riskData.active_corridor_risks.slice(0, 2).map(r => `  - ${r.corridor_name}: risk_level=${r.risk_level}, disruption_prob=${r.disruption_probability}`).join("\n")
      : "  No active corridor risks.";

    const commodityRisks = riskData.active_commodity_risks.length > 0
      ? riskData.active_commodity_risks.slice(0, 2).map(r => `  - ${r.commodity}: Risk ${r.risk_level}, Disruption Prob ${r.disruption_probability}%`).join("\n")
      : "  No active commodity risks.";

    const recentEvents = riskData.recent_disruption_events.length > 0
      ? riskData.recent_disruption_events.slice(0, 2).map(e => `  - [${e.risk_level}] ${e.event_type}: ${e.summary} (countries: ${e.countries}, commodities: ${e.commodities})`).join("\n")
      : "  No recent disruption events.";

    console.log(`[agent] Pre-fetched data ready. News: ${Array.isArray(newsData) ? newsData.length : 0} articles, Corridor risks: ${riskData.active_corridor_risks.length}, Commodity risks: ${riskData.active_commodity_risks.length}, Events: ${riskData.recent_disruption_events.length}`);

    // =====================================================
    // PHASE 1.5: Deterministic commodity prioritization
    // Sort by risk severity, pick top 4, map to HS codes
    // =====================================================
    const riskOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const hsCodeMap = {
      "brent crude": { hs: "27", label: "Mineral Fuels / Crude Oil" },
      "wti crude": { hs: "27", label: "Mineral Fuels / Crude Oil" },
      "natural gas": { hs: "27", label: "Natural Gas / Energy" },
      "copper": { hs: "74", label: "Copper" },
      "wheat": { hs: "10", label: "Cereals / Wheat" },
      "semiconductors": { hs: "85", label: "Electrical Equipment / Semiconductors" },
      "pharmaceuticals": { hs: "30", label: "Pharmaceuticals" },
      "iron ore": { hs: "26", label: "Ores / Iron Ore" },
      "electronics": { hs: "85", label: "Electrical Equipment" },
      "automotive": { hs: "87", label: "Vehicles / Automotive" },
      "steel": { hs: "72", label: "Iron and Steel" },
      "chemicals": { hs: "28", label: "Inorganic Chemicals" },
      "plastics": { hs: "39", label: "Plastics" },
      "textiles": { hs: "52", label: "Cotton / Textiles" },
      "machinery": { hs: "84", label: "Machinery" },
    };

    // Sort commodities by risk severity, then by disruption probability
    const sortedCommodities = [...riskData.active_commodity_risks]
      .sort((a, b) => {
        const riskDiff = (riskOrder[b.risk_level] || 0) - (riskOrder[a.risk_level] || 0);
        if (riskDiff !== 0) return riskDiff;
        return (b.disruption_probability || 0) - (a.disruption_probability || 0);
      });

    // Deduplicate by HS code (e.g. Brent Crude and WTI Crude both map to '27')
    const seen = new Set();
    const assignedCommodities = [];
    for (const c of sortedCommodities) {
      const key = c.commodity.toLowerCase();
      const mapping = hsCodeMap[key] || { hs: "TOTAL", label: c.commodity };
      if (seen.has(mapping.hs)) continue;
      seen.add(mapping.hs);
      assignedCommodities.push({
        commodity: c.commodity,
        label: mapping.label,
        hsCode: mapping.hs,
        riskLevel: c.risk_level,
        disruptionProb: c.disruption_probability
      });
      if (assignedCommodities.length >= 2) break;
    }

    const assignmentList = assignedCommodities
      .map((c, i) => `  ${i + 1}. **${c.label}** (HS code: '${c.hsCode}') — DB risk: ${c.riskLevel}, disruption probability: ${c.disruptionProb}%`)
      .join("\n");

    console.log(`[agent] Assigned commodities for analysis: ${assignedCommodities.map(c => c.label).join(", ")}`);

    // =====================================================
    // PHASE 2: LLM-driven analysis using pre-fetched data
    // The LLM receives real data and uses remaining tools for routing/logistics
    // =====================================================
    let structured = null;
    
    while (true) {
      try {
        const result = await invokeWithRetry(() => this.app.invoke({
          messages: [
            new HumanMessage([
              `Current analysis timestamp: ${startTime}`,
              "",
              "=== ROLE ===",
              "You are an adaptive procurement orchestrator. You have been given PRE-FETCHED supply chain intelligence data below. Your job is to analyze it and use the available tools (ports, routes, LPI, trade data, currency) to build detailed procurement recommendations for the ASSIGNED COMMODITIES listed below.",
              "",
              "=== PRE-FETCHED DATA: CURRENT NEWS ===",
              newsHeadlines,
              "",
              "=== PRE-FETCHED DATA: DATABASE CORRIDOR RISKS ===",
              corridorRisks,
              "",
              "=== PRE-FETCHED DATA: DATABASE COMMODITY RISKS ===",
              commodityRisks,
              "",
              "=== PRE-FETCHED DATA: RECENT DISRUPTION EVENTS ===",
              recentEvents,
              "",
              "=== YOUR ASSIGNED COMMODITIES (MANDATORY) ===",
              "You MUST produce exactly one recommendation for EACH of the following commodities.",
              "Do NOT substitute, skip, or change these. They were selected from the database by risk severity.",
              assignmentList,
              "",
              "=== WORKFLOW (for EACH assigned commodity) ===",
              "For EACH assigned commodity above, do ALL of the following steps:",
              "1. Determine the current disrupted source country from the news/risk data above.",
              "2. Pick an alternative source country that is a major producer of this commodity.",
              "3. Use 'search_ports' to find ports in the alternative country.",
              "4. Use 'geocode_location' to get coordinates for the port.",
              "5. Use 'calculate_sea_route' for overseas routes OR 'calculate_road_route' for nearby/land-connected countries.",
              "6. Use 'fetch_logistics_performance' to get the LPI score for the alternative country. PUT THIS VALUE in the 'logistics_performance_index' field AND in 'supplier_details.lpi_score'.",
              `7. Use 'fetch_un_comtrade' with the SPECIFIC HS code for that commodity (${assignedCommodities.map(c => `'${c.hsCode}' for ${c.label}`).join(", ")}).`,
              "8. Use 'convert_currency' to convert costs from USD to INR.",
              "",
              "=== OUTPUT REQUIREMENTS ===",
              "Return a JSON object with a 'recommendations' array. Each recommendation must have these fields:",
              "commodity, current_source, recommended_source, route_type, distance_km, duration_hours, transit_days, cost_usd, cost_local, currency, logistics_performance_index, urgency, recommendation_summary, rationale, confidence_score_percent, procurement_score_percent, top_ranked_alternatives, risk_breakdown, eta, cost_comparison, decision_factors, trigger_event, supplier_reliability, refinery_compatibility, route_health_score, data_sources_used, next_recommended_action, supplier_details, weighted_scoring, timestamp.",
              "",
              "CRITICAL RULES FOR EACH RECOMMENDATION:",
              "- Do NOT loop infinitely. Pick EXACTLY ONE alternative source country per commodity, search its port, and move on. Do NOT geocode every country in the world.",
              "- route_type: Use 'Pipeline' for crude oil/gas, 'Road' if distance < 2000km and land-connected, 'Sea' for overseas.",
              "- logistics_performance_index: MUST be the actual LPI value from fetch_logistics_performance. NEVER leave as null.",
              "- risk_breakdown: Each sub-score (geopolitical, weather, congestion) MUST be DIFFERENT per commodity based on actual conditions.",
              "- top_ranked_alternatives: Use DIFFERENT countries with DIFFERENT scores for each commodity.",
              "- decision_factors: Use commodity-SPECIFIC factors (e.g. 'Refinery compatibility' for crude oil, 'Semiconductor fabrication capacity' for electronics).",
              "- trigger_event: Describe the SPECIFIC triggering event from the news/risk data.",
              "- supplier_details.supplier_name: Use a REAL supplier/company name for that country and commodity.",
              "- recommendation_summary and rationale: Must be UNIQUE per commodity, citing specific data.",
              "- Return ONLY valid JSON. No markdown fences, no prologues, no explanation text."
            ].join("\n")),
          ],
        }));

        const rawContent = getFinalModelText(result);
        try {
          structured = parseJsonLoose(rawContent);
        } catch {
          console.warn("[agent] Direct JSON parse failed, triggering repair loop...");
          structured = await coerceStructuredJson(rawContent);
        }

        // Successfully ran, break out of retry loop
        break;
      } catch (error) {
        if (error.modelSwitched) {
          console.log(`[agent] Rebuilding graph with new model and retrying entire cycle...`);
          this.app = rebuildGraph();
          continue; // loop again with the new model
        }
        
        console.error("[agent] Cycle failed:", error.message);
        
        // If we've exhausted all models, use a safe fallback instead of crashing
        if (error.message.includes("No fallback available") || currentModelIndex >= MODEL_CHAIN.length - 1) {
          console.warn("[agent] ALL MODELS EXHAUSTED OR FAILED. Returning safe default recommendations.");
          structured = {
            recommendations: assignedCommodities.map(c => ({
              commodity: c.label,
              current_source: "Unknown",
              recommended_source: "Diversified Source",
              route_type: "Sea",
              distance_km: 5000,
              duration_hours: 240,
              transit_days: 10,
              cost_usd: 10000,
              cost_local: 840000,
              currency: "INR",
              logistics_performance_index: 3.0,
              urgency: c.riskLevel === "CRITICAL" ? "High" : "Medium",
              recommendation_summary: "Safe default generated due to LLM API failure.",
              rationale: "API limits exhausted. Diversification recommended.",
              confidence_score_percent: 50,
              procurement_score_percent: 50,
              top_ranked_alternatives: ["Alternative A", "Alternative B"],
              risk_breakdown: { geopolitical: 3, weather: 3, congestion: 3 },
              eta: "2026-07-15",
              cost_comparison: "N/A",
              decision_factors: "API Failover",
              trigger_event: "Risk identified in DB",
              supplier_reliability: 5,
              refinery_compatibility: 5,
              route_health_score: 5,
              data_sources_used: ["Failover DB"],
              next_recommended_action: "Review manually",
              supplier_details: { supplier_name: "TBD", lpi_score: 3.0 },
              weighted_scoring: { logistics_weight: 0.4, cost_weight: 0.3, risk_weight: 0.3 },
              timestamp: new Date().toISOString()
            }))
          };
          break;
        }

        await this.appendLog({
          timestamp: startTime,
          status: "error",
          error: error.message,
        });
        throw error;
      }
    }

    // Normalize: handle bare arrays or miskeyed objects
    structured = normalizeStructured(structured);

    // Post-process: compute dynamic values that the LLM tends to leave static
    if (structured?.recommendations?.length > 0) {
      structured.recommendations = postProcessRecommendations(structured.recommendations, assignedCommodities);
      console.log("[agent] Post-processing applied to all recommendations.");
    }

    console.log("\n[agent] Structured Procurement Recommendations:");
    console.log(JSON.stringify(structured, null, 2));

    // Persist the recommendations
    if (structured?.recommendations?.length > 0) {
      await persistRecommendations(structured);
    } else {
      console.log("[agent] No recommendations found to persist.");
    }

    await this.appendLog({
      timestamp: startTime,
      status: "success",
      recommendationsCount: structured?.recommendations?.length || 0,
    });

    return structured;
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
if (process.argv[1] && (process.argv[1].endsWith("adaptive_procurement_orchestrator.js") || process.argv.includes("--run"))) {
  const agent = new AdaptiveProcurementOrchestrator();
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

export { AdaptiveProcurementOrchestrator };
