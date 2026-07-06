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

// Initialize high-performance LLM for procurement orchestration
const orchestratorLlm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile", // Use 70B model for high quality reasoning
  temperature: 0.3, // Slight variety to allow updated outputs on each run
  maxRetries: 2
});

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

const tools = [
  fetchNewsTool,
  fetchDisruptionRisksTool,
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
  const model = orchestratorLlm.bindTools(tools);
  const toolNode = new ToolNode(tools);

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
    .compile();
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
    msg.includes("Rate limit reached")
  );
}

async function invokeWithRetry(fn, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxAttempts) throw error;
      const waitMs = Math.min(30000, 2000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 1000);
      console.warn(`[agent] Rate limit hit. Retry ${attempt}/${maxAttempts} in ${waitMs}ms...`);
      await sleep(waitMs);
    }
  }
}

// --- HELPER PARSING FUNCTIONS ---

function parseJsonLoose(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch { }

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

    try {
      const result = await invokeWithRetry(() => this.app.invoke({
        messages: [
          new HumanMessage([
            `Current analysis timestamp: ${startTime}`,
            "You are an adaptive procurement orchestrator agent. Your goal is to evaluate live supply chain disruption risks from both current news and database risk scores, and generate actionable procurement recommendations that teams can act on within hours. Make sure to generate timestamps and ETAs in the recommendations JSON based on the current analysis timestamp.",
            "You have access to several tools. Follow these steps to perform your evaluation:",
            "1. Fetch the latest current supply chain/logistics/sanctions news using 'fetch_news'. Identify key disrupted locations, countries, ports, corridors, and commodities mentioned in the news.",
            "2. Fetch the active disruption risks from the database using 'fetch_disruption_risks'. Note the commodities and corridors with high or critical risk levels.",
            "3. For the disrupted commodities, ports, corridors, and countries identified in both current news and database scores, look up alternative ports/suppliers. Use 'search_ports' to find ports and get their coordinates/attributes.",
            "4. Alternatively, use 'geocode_location' to get the coordinates of supplier cities or ports.",
            "5. Calculate shipping distances and estimated transit times for alternative routes. Use 'calculate_sea_route' for maritime paths and 'calculate_road_route' for land paths.",
            "6. Compare logistics performance for target alternative countries using 'fetch_logistics_performance' (logistics performance index).",
            "7. Query commercial trade stats if needed using 'fetch_un_comtrade' to understand supply-demand or partner volumes.",
            "8. Convert estimated landed procurement costs from USD to the target local currency (default INR) using 'convert_currency'.",
            "Correlate all this data to rank alternative sources and produce highly structured, specific, and actionable procurement recommendations.",
            "Your recommendations must specify the commodity, the current disrupted source (which should be based on or related to the location/issues found in the news or active disruptions), the recommended alternative, routing metrics (distance, duration), cost details in USD and local currency (INR), and a detailed rationale explaining how it mitigates the news/active disruption.",
            "",
            "Additional JSON Schema Requirements:",
            "- Convert confidence and procurement scores to percentages (integer values between 0 and 100).",
            "- Add exactly 3 to 5 ranked alternatives with score percentages in the 'top_ranked_alternatives' array.",
            "- Provide a detailed 'risk_breakdown' containing: disruption_probability_percent, geopolitical_risk_score, weather_risk_score, congestion_risk_score, overall_risk_score.",
            "- Provide a detailed 'cost_comparison' containing: base_cost_usd, freight_cost_usd, customs_tariffs_usd, total_landed_cost_usd, total_cost_local, savings_or_premium_usd.",
            "- Populate 'transit_days' and a descriptive 'eta'.",
            "- Detail 'weighted_scoring' explaining weights (e.g. logistics weight, cost weight, risk weight, calculated overall score).",
            "- Provide 'supplier_details' (supplier name, country, lpi score, harbor size, harbor type).",
            "- Use a neutral, non-alarmist 'trigger_event' (e.g., 'Routine Route Disruption Check' or 'Standard Supply Chain Rerouting Optimization Event').",
            "- Detail 'decision_factors' with descriptive name and detailed description elements.",
            "- Provide timestamps in ISO format.",
            "",
            "Return ONLY a valid JSON payload matching this exact schema layout:",
            JSON.stringify(SCHEMA_TEMPLATE, null, 2),
            "",
            "Constraints:",
            "- urgency must be exactly one of: LOW, MEDIUM, HIGH, CRITICAL",
            "- route_type must be one of: Sea, Road, Rail, Air, Pipeline",
            "- Ensure that the routing distances (distance_km), transit durations (duration_hours, transit_days), and logistics performance indices correspond EXACTLY to the recommended alternative source, and are not mixed up with other alternatives.",
            "- Return ONLY valid JSON. No conversational prologues, epilogues, or explanation wrappers."
          ].join("\n")),
        ],
      }));

      const rawContent = getFinalModelText(result);
      let structured;
      try {
        structured = parseJsonLoose(rawContent);
      } catch {
        console.warn("[agent] Direct JSON parse failed, triggering repair loop...");
        structured = await coerceStructuredJson(rawContent);
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
