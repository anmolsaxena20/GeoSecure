import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Import DB operations
import { pool } from "../../db/db.js";

// Import services
import { fetchGuardianNews } from "../../services/guardianService.js";
import { fetchWorldBankIndicators } from "../../services/worldBankService.js";
import { fetchCommodities, fetchForex, fetchStocks } from "../../services/alphaVantageService.js";
import { fetchUNComtradeData } from "../../services/unComtradeService.js";
import { fetchChokepointWeather, fetchNasaEonetEvents } from "../../services/weatherDisasterService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const LOG_FILE_PATH = path.resolve(__dirname, "../../logs/supply_chain_copilot.log");

// --- MODEL FALLBACK CHAIN ---
const MODEL_CHAIN = [
  "llama-3.3-70b-versatile",
  "llama-3.3-70b-specdec",
  "llama-3.1-8b-instant",
];

let currentModelIndex = 0;

function createLlm(modelName) {
  console.log(`[copilot] Using model: ${modelName}`);
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: modelName,
    temperature: 0.2,
    maxRetries: 2,
  });
}

let copilotLlm = createLlm(MODEL_CHAIN[currentModelIndex]);

function switchToNextModel() {
  currentModelIndex++;
  if (currentModelIndex >= MODEL_CHAIN.length) {
    console.error("[copilot] All models exhausted. No fallback available.");
    return false;
  }
  const nextModel = MODEL_CHAIN[currentModelIndex];
  console.warn(`[copilot] Switching to fallback model: ${nextModel}`);
  copilotLlm = createLlm(nextModel);
  return true;
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
  return (
    msg.includes("decommissioned") ||
    msg.includes("does not exist") ||
    error?.status === 400 ||
    error?.status === 404
  );
}

async function invokeWithRetry(fn, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isDailyLimitError(error) || isModelDecommissionedError(error)) {
        console.warn(`[copilot] Model unavailable: ${error.message}`);
        const switched = switchToNextModel();
        if (!switched) throw error;
        throw Object.assign(new Error("MODEL_SWITCHED"), { modelSwitched: true });
      }
      if (!isRateLimitError(error)) throw error;
      if (attempt === maxAttempts) {
        console.warn("[copilot] Max retries reached for rate limit.");
        const switched = switchToNextModel();
        if (!switched) throw error;
        throw Object.assign(new Error("MODEL_SWITCHED"), { modelSwitched: true });
      }
      const waitMs = Math.min(30000, 2000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 1000);
      console.warn(`[copilot] Rate limit hit. Retry ${attempt}/${maxAttempts} in ${waitMs}ms...`);
      await sleep(waitMs);
    }
  }
}

// --- DANGEROUS SQL KEYWORDS ---

const DANGEROUS_SQL_PATTERN = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|EXEC)\b/i;

// --- ALPHA VANTAGE DATA TRIMMER ---

function trimCommodityData(rawCommodities) {
  const trimmed = {};
  for (const [key, val] of Object.entries(rawCommodities || {})) {
    if (val && Array.isArray(val.data)) {
      trimmed[key] = {
        name: val.name,
        unit: val.unit,
        data: val.data.slice(0, 1),
      };
    } else {
      trimmed[key] = val;
    }
  }
  return trimmed;
}

// --- SYSTEM PROMPT ---

const SYSTEM_PROMPT = `You are the GeoSecure Supply Chain Copilot — an AI-powered supply chain intelligence assistant for trade-driven economies.

Your role is to help users understand, monitor, and act on supply chain risks, logistics data, market signals, and procurement insights by answering their questions accurately and concisely.

## Capabilities

You have access to the following tools:

1. **query_database** — Execute read-only SQL queries against the PostgreSQL database to retrieve historical data, risk scores, events, procurement recommendations, scenario runs, and more.
2. **get_database_schema** — Retrieve the database table and column metadata so you can write accurate SQL queries.
3. **fetch_supply_chain_news** — Get the latest supply chain, logistics, shipping, and sanctions news from The Guardian.
4. **fetch_market_data** — Get real-time energy/commodity prices, USD/INR forex rates, and logistics/semiconductor stock quotes from Alpha Vantage.
5. **fetch_world_bank_indicators** — Get macroeconomic indicators (trade-to-GDP ratio, inflation, GDP growth, container port traffic) from the World Bank.
6. **fetch_trade_statistics** — Get global import/export trade flow volumes and values from the UN Comtrade API.
7. **fetch_chokepoint_weather** — Get real-time weather at major shipping chokepoints (Suez Canal, Panama Canal, Singapore, Rotterdam, Shanghai).
8. **fetch_natural_disasters** — Get active global natural disaster events (storms, wildfires, floods, volcanoes) from NASA EONET.
9. **search_ports** — Search the World Port Index for port characteristics, facilities, and coordinates.
10. **convert_currency** — Get real-time currency exchange rates (e.g. USD to INR).

## Database Schema (EXACT column names — use these EXACTLY)

**events** — Supply chain disruption events:
  id (integer), article_id (integer), event_type (varchar), summary (text),
  countries (JSONB), commodities (JSONB), transport_modes (JSONB),
  impacts (JSONB), recommendations (JSONB), risk_score (integer), risk_level (varchar),
  created_at (timestamp)

**commodity_risk_scores** — Risk scores per commodity:
  id (integer), commodity (varchar), disruption_probability (integer),
  risk_level (varchar), updated_at (timestamp)

**articles** — Persisted news articles from Guardian:
  id (integer), source (varchar), external_id (varchar), headline (text),
  url (text), published_at (timestamp), raw_content (text), created_at (timestamp)

**corridor_risk_scores** — Risk scores per trade corridor:
  corridor_name (varchar), disruption_probability (integer), risk_level (varchar)

**scenario_runs** — Simulation scenario results:
  id (integer), session_id (integer), scenario_name (varchar), duration_days (integer),
  gdp_loss (decimal), inflation (decimal), fuel_shortage (decimal), oil_price (decimal),
  risk_score (decimal), executed_at (timestamp)

**strategic_recommendations** — Recommendations from scenario analysis:
  id (integer), scenario_id (integer), recommendation_type (varchar), title (varchar),
  recommendation (text), confidence (decimal), priority (varchar),
  estimated_impact (text), created_at (timestamp)

**procurement_recommendations** — AI-generated procurement recommendations:
  commodity (varchar), current_source (varchar), alternative_source (varchar),
  route_type (varchar), distance_km (decimal), cost_usd (decimal),
  urgency (varchar), risk_breakdown (jsonb)

**users** — User accounts: id, name, email, role, created_at
**chat_sessions** — Chat sessions: id, user_id, session_title, created_at, updated_at
**chat_messages** — Messages: id, session_id, sender, message, created_at
**ai_requests** — AI query logs: id, session_id, user_query, detected_intent, processing_time
**ai_responses** — AI response logs: id, request_id, response, confidence, generated_by
**feedback** — User feedback: id, response_id, rating, comments
**saved_simulations** — Bookmarks: id, user_id, scenario_id, title, notes
**conversation_memory** — Key-value memory: id, session_id, memory_key, memory_value
**ai_actions** — Action log: id, request_id, action_name, parameters (jsonb), result (jsonb)
**agent_logs** — Agent execution logs: id, request_id, agent_name, status, execution_time
**response_sources** — Sources: id, response_id, source_type, source_name, source_reference
**sql_logs** — SQL audit: id, request_id, generated_sql, execution_time, rows_returned

## CRITICAL RULES

- **ALWAYS use the EXACT column names shown above.** The events table has "commodities" (JSONB), NOT "commodity". The commodity_risk_scores table has "commodity" (varchar).
- JSONB columns (countries, commodities, transport_modes, impacts, recommendations) contain JSON arrays or objects. Query them with PostgreSQL JSON operators (e.g. \`commodities::text ILIKE '%oil%'\`, \`jsonb_array_elements_text(countries) as country\`).
- Only execute SELECT queries. Never attempt to modify data.
- When unsure about a table's structure, use **get_database_schema** FIRST before writing SQL.

## MULTI-TOOL STRATEGY (MANDATORY)

You MUST use MULTIPLE tools together for complex or analytical questions. **Never answer a "why" or analysis question using only the database.** Follow this strategy:

1. **For "why" questions** (e.g. "Why is Australia high risk?"):
   - FIRST: Query the database for relevant events, risk scores, and details about the topic
   - THEN: Use **fetch_supply_chain_news** to get recent news about that country/commodity/topic
   - THEN: Use **fetch_natural_disasters** or **fetch_chokepoint_weather** if the question involves geography or logistics
   - FINALLY: Synthesize ALL data sources into a comprehensive analytical answer

2. **For risk/disruption questions**:
   - Query database for risk scores AND event details (summary, impacts, recommendations)
   - Fetch news for real-time context
   - Check weather/disasters for environmental factors
   - Check market data if commodities are involved

3. **For market/trade questions**:
   - Use **fetch_market_data** for commodity prices
   - Use **fetch_trade_statistics** for import/export data
   - Use **fetch_world_bank_indicators** for economic context
   - Cross-reference with database events

4. **For location/route questions**:
   - Use **search_ports** for port information
   - Use **fetch_chokepoint_weather** for weather at shipping lanes
   - Query database for corridor risk scores and events

**NEVER give a vague answer like "we need more data" — always use your tools to fetch that data.**

## RESPONSE GUIDELINES

- Be concise but thorough. Use bullet points and structured formatting.
- When presenting numbers, include units and context (e.g. "Brent crude at $72.50/barrel, up 3.2% this month").
- If a tool call fails or returns no data, try alternative tools or queries rather than giving up.
- Always cite which tools/data sources you used in your answer.`;

// --- TOOL DEFINITIONS ---

const queryDatabaseTool = tool(
  async ({ sql_query }) => {
    console.log(`[tool] Executing SQL: ${sql_query.substring(0, 200)}...`);

    // Safety check: reject dangerous statements
    if (DANGEROUS_SQL_PATTERN.test(sql_query)) {
      return "Error: Only read-only SELECT queries are allowed. Modification statements (INSERT, UPDATE, DELETE, DROP, etc.) are not permitted.";
    }

    const client = await pool.connect();
    try {
      // Enforce read-only transaction
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql_query);
      await client.query("COMMIT");

      if (!result.rows || result.rows.length === 0) {
        return "Query executed successfully but returned no rows.";
      }

      // Limit output to avoid token overflow
      const rows = result.rows.slice(0, 50);
      return JSON.stringify({
        row_count: result.rows.length,
        rows_shown: rows.length,
        data: rows,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[tool] SQL execution failed:", error.message);
      return `SQL Error: ${error.message}`;
    } finally {
      client.release();
    }
  },
  {
    name: "query_database",
    description:
      "Execute a read-only SQL SELECT query against the PostgreSQL database. Use this to retrieve historical data, risk scores, events, recommendations, scenario results, and other stored information. Only SELECT statements are allowed.",
    schema: z.object({
      sql_query: z
        .string()
        .describe(
          "The SQL SELECT query to execute. Must be a read-only query. Example: SELECT * FROM events WHERE risk_level = 'CRITICAL' ORDER BY risk_score DESC LIMIT 10"
        ),
    }),
  }
);

const getDatabaseSchemaTool = tool(
  async ({ table_name }) => {
    console.log(`[tool] Fetching database schema${table_name ? ` for table: ${table_name}` : " (all tables)"}...`);
    try {
      let query;
      let params = [];

      if (table_name) {
        query = `
          SELECT table_name, column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `;
        params = [table_name];
      } else {
        query = `
          SELECT table_name, column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `;
      }

      const result = await pool.query(query, params);

      if (!result.rows || result.rows.length === 0) {
        return table_name
          ? `Table '${table_name}' not found in the database.`
          : "No tables found in the public schema.";
      }

      // Group columns by table for readability
      const grouped = {};
      for (const row of result.rows) {
        if (!grouped[row.table_name]) grouped[row.table_name] = [];
        grouped[row.table_name].push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable,
          default: row.column_default || null,
        });
      }

      return JSON.stringify(grouped);
    } catch (error) {
      console.error("[tool] Schema fetch failed:", error.message);
      return `Error fetching database schema: ${error.message}`;
    }
  },
  {
    name: "get_database_schema",
    description:
      "Retrieve the database table and column metadata from PostgreSQL information_schema. Use this before writing SQL queries to understand table structures, column names, and data types. Pass a specific table_name to get details for one table, or omit it to see all tables.",
    schema: z.object({
      table_name: z
        .string()
        .optional()
        .describe(
          "Optional specific table name to inspect (e.g. 'events', 'procurement_recommendations'). Omit to list all tables."
        ),
    }),
  }
);

const fetchNewsTool = tool(
  async () => {
    console.log("[tool] Fetching Guardian supply chain news...");
    try {
      const news = await fetchGuardianNews();
      return JSON.stringify(news);
    } catch (error) {
      console.error("[tool] Guardian news fetch failed:", error.message);
      return `Error fetching Guardian news: ${error.message}`;
    }
  },
  {
    name: "fetch_supply_chain_news",
    description:
      "Fetch the latest supply chain, shipping, logistics, and sanctions news articles from The Guardian API. Returns headlines, publication dates, URLs, and summaries.",
    schema: z.object({}),
  }
);

const fetchMarketDataTool = tool(
  async () => {
    console.log("[tool] Fetching Alpha Vantage market data...");
    try {
      const commodities = await fetchCommodities();
      const forex = await fetchForex();
      const stocks = await fetchStocks();
      const trimmedCommodities = trimCommodityData(commodities);
      return JSON.stringify({ commodities: trimmedCommodities, forex, stocks });
    } catch (error) {
      console.error("[tool] Alpha Vantage fetch failed:", error.message);
      return `Error fetching market data: ${error.message}`;
    }
  },
  {
    name: "fetch_market_data",
    description:
      "Fetch real-time energy/commodity prices (Brent crude, WTI, natural gas, copper, wheat), USD/INR forex rate, and logistics/semiconductor stock quotes (FDX, UPS, ZIM, TSM, NVDA, CAT, XLE, SPY) from Alpha Vantage.",
    schema: z.object({}),
  }
);

const fetchWorldBankTool = tool(
  async () => {
    console.log("[tool] Fetching World Bank indicators...");
    try {
      const indicators = await fetchWorldBankIndicators();
      return JSON.stringify(indicators);
    } catch (error) {
      console.error("[tool] World Bank fetch failed:", error.message);
      return `Error fetching World Bank indicators: ${error.message}`;
    }
  },
  {
    name: "fetch_world_bank_indicators",
    description:
      "Fetch macroeconomic indicators from the World Bank API: trade-to-GDP ratio, inflation rate, GDP growth rate, and container port traffic volume.",
    schema: z.object({}),
  }
);

const fetchTradeStatsTool = tool(
  async (args) => {
    console.log("[tool] Fetching UN Comtrade trade statistics...");
    try {
      const data = await fetchUNComtradeData(args || {});
      return JSON.stringify(data);
    } catch (error) {
      console.error("[tool] UN Comtrade fetch failed:", error.message);
      return `Error fetching UN Comtrade trade data: ${error.message}`;
    }
  },
  {
    name: "fetch_trade_statistics",
    description:
      "Fetch global import/export trade flow volumes and values from the UN Comtrade API. Can filter by reporter country, partner country, year, flow direction, and commodity code.",
    schema: z.object({
      reporterCode: z
        .string()
        .optional()
        .describe("UN M49 code of reporting country (e.g. '356' for India, '51' for Armenia, 'all')"),
      partnerCode: z
        .string()
        .optional()
        .describe("UN M49 code of partner country (e.g. '0' for World)"),
      period: z
        .string()
        .optional()
        .describe("Year of reporting (e.g. '2025' or '2024')"),
      flowCode: z
        .string()
        .optional()
        .describe("'M' for Imports, 'X' for Exports"),
      cmdCode: z
        .string()
        .optional()
        .describe(
          "HS commodity code: 'TOTAL' for all, '27' for mineral fuels/oil, '72' for iron/steel, '84' for machinery, '85' for electrical equipment, '30' for pharmaceuticals"
        ),
    }),
  }
);

const fetchWeatherTool = tool(
  async () => {
    console.log("[tool] Fetching chokepoint weather data...");
    try {
      const data = await fetchChokepointWeather();
      return JSON.stringify(data);
    } catch (error) {
      console.error("[tool] Chokepoint weather fetch failed:", error.message);
      return `Error fetching chokepoint weather: ${error.message}`;
    }
  },
  {
    name: "fetch_chokepoint_weather",
    description:
      "Fetch real-time weather conditions (temperature, wind speed, rain, weather code) at major global shipping chokepoints: Suez Canal, Panama Canal, Port of Singapore, Port of Rotterdam, and Port of Shanghai.",
    schema: z.object({}),
  }
);

const fetchDisastersTool = tool(
  async () => {
    console.log("[tool] Fetching active natural disasters...");
    try {
      const data = await fetchNasaEonetEvents();
      return JSON.stringify(data);
    } catch (error) {
      console.error("[tool] NASA EONET fetch failed:", error.message);
      return `Error fetching natural disasters: ${error.message}`;
    }
  },
  {
    name: "fetch_natural_disasters",
    description:
      "Fetch active global natural disaster events (storms, wildfires, floods, volcanic activity) from NASA EONET. Returns event titles, categories, dates, and geographic coordinates.",
    schema: z.object({}),
  }
);

const searchPortsTool = tool(
  async ({ portName }) => {
    console.log(`[tool] Searching ports: ${portName}`);
    try {
      const url = `https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/World_Port_Index/FeatureServer/0/query?where=UPPER(PORT_NAME)%20LIKE%20UPPER('%25${encodeURIComponent(portName)}%25')&outFields=*&f=json`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        return `No ports found matching: ${portName}`;
      }
      const ports = data.features.map((f) => ({
        port_name: f.attributes.PORT_NAME,
        country: f.attributes.COUNTRY,
        latitude: f.attributes.LATITUDE,
        longitude: f.attributes.LONGITUDE,
        harbor_size: f.attributes.HARBORSIZE,
        harbor_type: f.attributes.HARBORTYPE,
        provisions: f.attributes.PROVISIONS,
        fuel_oil: f.attributes.FUEL_OIL,
        diesel: f.attributes.DIESEL,
      }));
      return JSON.stringify(ports.slice(0, 5));
    } catch (error) {
      console.error("[tool] Port search failed:", error.message);
      return `Error searching ports: ${error.message}`;
    }
  },
  {
    name: "search_ports",
    description:
      "Search the World Port Index (ArcGIS) by port name. Returns port characteristics including name, country, coordinates, harbor size/type, and available facilities (fuel, provisions, diesel).",
    schema: z.object({
      portName: z.string().describe("Name of the port to search for (e.g. 'Singapore', 'Rotterdam', 'Mumbai')"),
    }),
  }
);

const convertCurrencyTool = tool(
  async ({ fromCurrency, toCurrency }) => {
    const from = fromCurrency || "USD";
    const to = toCurrency || "INR";
    console.log(`[tool] Converting currency: ${from} → ${to}`);
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
        date: data.date,
      });
    } catch (error) {
      console.error("[tool] Currency conversion failed:", error.message);
      return `Error fetching exchange rate: ${error.message}`;
    }
  },
  {
    name: "convert_currency",
    description:
      "Get real-time currency exchange rates using the Frankfurter API. Defaults to USD → INR if no currencies specified.",
    schema: z.object({
      fromCurrency: z.string().optional().describe("Source currency code (e.g. 'USD', 'EUR')"),
      toCurrency: z.string().optional().describe("Target currency code (e.g. 'INR', 'GBP')"),
    }),
  }
);

// All tools available to the copilot
const tools = [
  queryDatabaseTool,
  getDatabaseSchemaTool,
  fetchNewsTool,
  fetchMarketDataTool,
  fetchWorldBankTool,
  fetchTradeStatsTool,
  fetchWeatherTool,
  fetchDisastersTool,
  searchPortsTool,
  convertCurrencyTool,
];

// --- GRAPH SETUP ---

function createGraphApp() {
  const model = copilotLlm.bindTools(tools);
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
    .compile({ recursionLimit: 30 });
}

// --- HELPER FUNCTIONS ---

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

// --- DATABASE PERSISTENCE ---

async function ensureCopilotTablesExist() {
  // Tables are assumed to exist per schema.txt — this is a safety check
  try {
    await pool.query("SELECT 1 FROM chat_sessions LIMIT 0");
    await pool.query("SELECT 1 FROM chat_messages LIMIT 0");
    await pool.query("SELECT 1 FROM ai_requests LIMIT 0");
    await pool.query("SELECT 1 FROM ai_responses LIMIT 0");
    console.log("[copilot] Database tables verified.");
  } catch (error) {
    console.warn("[copilot] Some copilot tables may not exist yet:", error.message);
  }
}

async function createChatSession(userId, title) {
  const result = await pool.query(
    `INSERT INTO chat_sessions (user_id, session_title) VALUES ($1, $2) RETURNING *`,
    [userId, title || "New Supply Chain Chat"]
  );
  return result.rows[0];
}

async function loadConversationHistory(sessionId, limit = 20) {
  const result = await pool.query(
    `SELECT sender, message FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );

  // Reverse to get chronological order
  return result.rows.reverse().map((row) => {
    if (row.sender === "USER") {
      return new HumanMessage(row.message);
    }
    return new AIMessage(row.message);
  });
}

async function saveUserMessage(sessionId, message) {
  await pool.query(
    `INSERT INTO chat_messages (session_id, sender, message) VALUES ($1, 'USER', $2)`,
    [sessionId, message]
  );
}

async function saveAIMessage(sessionId, message) {
  await pool.query(
    `INSERT INTO chat_messages (session_id, sender, message) VALUES ($1, 'AI', $2)`,
    [sessionId, message]
  );
}

async function saveAIRequest(sessionId, userQuery, detectedIntent, processingTime) {
  const result = await pool.query(
    `INSERT INTO ai_requests (session_id, user_query, detected_intent, processing_time)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [sessionId, userQuery, detectedIntent, processingTime]
  );
  return result.rows[0].id;
}

async function saveAIResponse(requestId, response, confidence, generatedBy) {
  const result = await pool.query(
    `INSERT INTO ai_responses (request_id, response, confidence, generated_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [requestId, response, confidence, generatedBy]
  );
  return result.rows[0].id;
}

async function saveResponseSource(responseId, sourceType, sourceName, sourceReference) {
  await pool.query(
    `INSERT INTO response_sources (response_id, source_type, source_name, source_reference)
     VALUES ($1, $2, $3, $4)`,
    [responseId, sourceType, sourceName, sourceReference || null]
  );
}

async function saveAgentLog(requestId, agentName, status, executionTime, outputSummary) {
  await pool.query(
    `INSERT INTO agent_logs (request_id, agent_name, status, execution_time, output_summary)
     VALUES ($1, $2, $3, $4, $5)`,
    [requestId, agentName, status, executionTime, outputSummary]
  );
}

async function updateSessionTimestamp(sessionId) {
  await pool.query(
    `UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [sessionId]
  );
}

// Detect intent from the user query (lightweight classification)
function detectIntent(query) {
  const q = query.toLowerCase();
  if (q.includes("risk") || q.includes("disrupt") || q.includes("threat")) return "RISK_ANALYSIS";
  if (q.includes("news") || q.includes("headline") || q.includes("latest")) return "NEWS_QUERY";
  if (q.includes("price") || q.includes("market") || q.includes("stock") || q.includes("commodity")) return "MARKET_DATA";
  if (q.includes("trade") || q.includes("import") || q.includes("export") || q.includes("comtrade")) return "TRADE_STATISTICS";
  if (q.includes("weather") || q.includes("chokepoint") || q.includes("canal")) return "WEATHER_QUERY";
  if (q.includes("disaster") || q.includes("earthquake") || q.includes("flood") || q.includes("storm")) return "DISASTER_QUERY";
  if (q.includes("port") || q.includes("harbor") || q.includes("terminal")) return "PORT_SEARCH";
  if (q.includes("currency") || q.includes("exchange") || q.includes("forex") || q.includes("convert")) return "CURRENCY_QUERY";
  if (q.includes("procurement") || q.includes("supplier") || q.includes("source") || q.includes("buy")) return "PROCUREMENT_QUERY";
  if (q.includes("scenario") || q.includes("simulation") || q.includes("what if")) return "SCENARIO_ANALYSIS";
  if (q.includes("recommend") || q.includes("suggest") || q.includes("advise")) return "RECOMMENDATION";
  return "GENERAL_QUERY";
}

// Extract which tools were used from the LangGraph result messages
function extractToolsUsed(result) {
  const toolsUsed = new Set();
  for (const msg of result.messages || []) {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        toolsUsed.add(tc.name);
      }
    }
  }
  return Array.from(toolsUsed);
}

// --- MAIN COPILOT CLASS ---

class SupplyChainCopilot {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
    }
    this.app = null;
    this.maxGraphRetries = 3;
  }

  /**
   * Build (or rebuild) the LangGraph application.
   * Called lazily on first chat or after a model switch.
   */
  buildGraph() {
    this.app = createGraphApp();
  }

  /**
   * Create a new chat session for a user.
   * @param {number} userId - The user's ID
   * @param {string} [title] - Optional session title
   * @returns {Promise<Object>} The created session row
   */
  async createSession(userId, title) {
    return await createChatSession(userId, title);
  }

  /**
   * Main chat entry point. Accepts a user message, invokes the LangGraph agent,
   * persists everything to the database, and returns the AI response.
   *
   * @param {string} userMessage - The user's query
   * @param {number} sessionId - The chat session ID
   * @param {number} [userId] - Optional user ID for logging
   * @returns {Promise<Object>} { response, intent, tools_used, processing_time_ms }
   */
  async chat(userMessage, sessionId, userId = null) {
    const startTime = Date.now();
    console.log(`[copilot] Chat request — session=${sessionId}, message="${userMessage.substring(0, 100)}..."`);

    try {
      // 1. Save user message to chat history
      await saveUserMessage(sessionId, userMessage);

      // 2. Load conversation history for multi-turn context
      const history = await loadConversationHistory(sessionId);

      // 3. Detect intent (lightweight, for logging/analytics)
      const intent = detectIntent(userMessage);

      // 4. Build messages array: system + history + current user message
      const messages = [
        new SystemMessage(SYSTEM_PROMPT),
        ...history.slice(0, -1), // history already includes the just-saved user message at the end
        new HumanMessage(userMessage),
      ];

      // 5. Invoke the LangGraph agent (with model switch retries)
      if (!this.app) this.buildGraph();

      let result;
      for (let graphAttempt = 1; graphAttempt <= this.maxGraphRetries; graphAttempt++) {
        try {
          result = await this.app.invoke({ messages });
          break;
        } catch (err) {
          if (err.modelSwitched && graphAttempt < this.maxGraphRetries) {
            console.log(`[copilot] Model switched, rebuilding graph (attempt ${graphAttempt})...`);
            this.buildGraph();
            continue;
          }
          throw err;
        }
      }

      // 6. Extract the final AI response text
      const responseText = getFinalModelText(result);
      const processingTime = Date.now() - startTime;

      // 7. Extract tools used for source tracking
      const toolsUsed = extractToolsUsed(result);

      // 8. Persist everything to the database
      try {
        // Save AI message to chat history
        await saveAIMessage(sessionId, responseText);

        // Log the AI request
        const requestId = await saveAIRequest(
          sessionId,
          userMessage,
          intent,
          processingTime / 1000
        );

        // Log the AI response
        const responseId = await saveAIResponse(
          requestId,
          responseText,
          0.85, // Default confidence
          MODEL_CHAIN[currentModelIndex]
        );

        // Log tool sources
        for (const toolName of toolsUsed) {
          await saveResponseSource(responseId, "tool", toolName);
        }

        // Log agent execution
        await saveAgentLog(
          requestId,
          "supply_chain_copilot",
          "success",
          processingTime / 1000,
          `Answered query with intent=${intent}, tools_used=[${toolsUsed.join(", ")}]`
        );

        // Update session timestamp
        await updateSessionTimestamp(sessionId);
      } catch (dbError) {
        // Don't let persistence failures block the response
        console.error("[copilot] Database persistence error (non-fatal):", dbError.message);
      }

      // 9. Append log to file
      await this.appendLog({
        timestamp: new Date().toISOString(),
        sessionId,
        intent,
        toolsUsed,
        processingTimeMs: processingTime,
        status: "success",
      });

      console.log(`[copilot] Response generated in ${processingTime}ms using tools: [${toolsUsed.join(", ")}]`);

      return {
        response: responseText,
        intent,
        tools_used: toolsUsed,
        processing_time_ms: processingTime,
        model: MODEL_CHAIN[currentModelIndex],
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error("[copilot] Chat failed:", error.message);

      await this.appendLog({
        timestamp: new Date().toISOString(),
        sessionId,
        status: "error",
        error: error.message,
        processingTimeMs: processingTime,
      });

      throw error;
    }
  }

  /**
   * Get all chat sessions for a user.
   * @param {number} userId
   * @returns {Promise<Array>} List of session objects
   */
  async getUserSessions(userId) {
    const result = await pool.query(
      `SELECT id, session_title, created_at, updated_at
       FROM chat_sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get all messages in a session.
   * @param {number} sessionId
   * @returns {Promise<Array>} List of message objects
   */
  async getSessionMessages(sessionId) {
    const result = await pool.query(
      `SELECT id, sender, message, created_at
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );
    return result.rows;
  }

  /**
   * Append a log entry to the copilot log file.
   * @param {Object} entry - Log data to persist
   */
  async appendLog(entry) {
    try {
      await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
      await fs.appendFile(LOG_FILE_PATH, `${JSON.stringify(entry)}\n`, "utf8");
    } catch (err) {
      console.error("[copilot] Logging failed:", err.message);
    }
  }
}

// --- CLI SUPPORT ---

if (
  process.argv[1] &&
  (process.argv[1].endsWith("supply_chain_copilot.js") || process.argv.includes("--run"))
) {
  const { createInterface } = await import("readline");

  const copilot = new SupplyChainCopilot();

  (async () => {
    try {
      await ensureCopilotTablesExist();

      // Ensure a demo user exists (upsert to avoid FK violation)
      const userResult = await pool.query(
        `INSERT INTO users (name, email, role)
         VALUES ('CLI Demo User', 'cli-demo@geosecure.local', 'Analyst')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`
      );
      const userId = userResult.rows[0].id;

      const session = await copilot.createSession(userId, "CLI Interactive Session");
      console.log(`\n🚀 Supply Chain Copilot — Interactive Mode`);
      console.log(`   Session: ${session.id} | User: ${userId}`);
      console.log(`   Type your query and press Enter. Type "exit" or "quit" to end.\n`);

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "You > ",
      });

      rl.prompt();

      rl.on("line", async (line) => {
        const query = line.trim();

        if (!query) {
          rl.prompt();
          return;
        }

        if (query.toLowerCase() === "exit" || query.toLowerCase() === "quit") {
          console.log("\n👋 Goodbye!");
          rl.close();
          process.exit(0);
        }

        try {
          console.log("\n⏳ Thinking...\n");
          const result = await copilot.chat(query, session.id, userId);

          console.log("========== COPILOT RESPONSE ==========");
          console.log(result.response);
          console.log("\n---------- Metadata ----------");
          console.log(`Intent: ${result.intent} | Tools: ${result.tools_used.join(", ") || "none"} | Time: ${result.processing_time_ms}ms | Model: ${result.model}`);
          console.log("==================================\n");
        } catch (err) {
          console.error(`\n❌ Error: ${err.message}\n`);
        }

        rl.prompt();
      });

      rl.on("close", () => {
        process.exit(0);
      });
    } catch (error) {
      console.error("[cli] Fatal error:", error.message);
      process.exit(1);
    }
  })();
}

export { SupplyChainCopilot, ensureCopilotTablesExist };
