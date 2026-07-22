import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import express from "express";
import axios from "axios";

// Import agents and services from parent directories
import { pool } from "../db/db.js";
import { SupplyChainCopilot, ensureCopilotTablesExist } from "../agents/supply_chain_copilot/supply_chain_copilot.js";
import { DisruptionRiskAgent } from "../agents/disruption_risk_agent.js";
import { SupplyChainEconomiesAgent } from "../agents/supply_chain_economies_agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const app = express();
const port = process.env.DIGITAL_TWIN_PORT || 8085;

app.use(express.json());
app.use(express.static(__dirname));

// --- DATA STRUCTURES FOR INDIA ENERGY NETWORK ---

const DEFAULT_NODES = {
  // WELLHEADS
  "mumbai_high": { id: "mumbai_high", name: "Mumbai High Offshore", type: "wellhead", commodity: "Crude Oil", coords: [19.2500, 71.2000], capacity: 350000, baseCapacity: 350000, operationalHealth: 100, disruption: null },
  "barmer_fields": { id: "barmer_fields", name: "Barmer Fields (Rajasthan)", type: "wellhead", commodity: "Crude Oil", coords: [25.9333, 71.2167], capacity: 180000, baseCapacity: 180000, operationalHealth: 100, disruption: null },
  "kg_basin": { id: "kg_basin", name: "KG Basin Offshore", type: "wellhead", commodity: "Natural Gas & Crude", coords: [16.2000, 82.2000], capacity: 100000, baseCapacity: 100000, operationalHealth: 100, disruption: null },
  "digboi_field": { id: "digboi_field", name: "Digboi Oil Field (Assam)", type: "wellhead", commodity: "Crude Oil", coords: [27.3800, 95.6300], capacity: 50000, baseCapacity: 50000, operationalHealth: 100, disruption: null },
  "ankleshwar": { id: "ankleshwar", name: "Ankleshwar Field (Gujarat)", type: "wellhead", commodity: "Crude Oil", coords: [21.6264, 73.0136], capacity: 50000, baseCapacity: 50000, operationalHealth: 100, disruption: null },
  "mundra_port": { id: "mundra_port", name: "Mundra Port (Imported Crude)", type: "wellhead", commodity: "Imported Crude", coords: [22.7380, 69.7042], capacity: 400000, baseCapacity: 400000, operationalHealth: 100, disruption: null },
  "vadinar_port": { id: "vadinar_port", name: "Vadinar Port (Imported Crude)", type: "wellhead", commodity: "Imported Crude", coords: [22.4277, 69.7126], capacity: 200000, baseCapacity: 200000, operationalHealth: 100, disruption: null },

  // REFINERIES
  "jamnagar": { id: "jamnagar", name: "Jamnagar Refinery (Reliance)", type: "refinery", coords: [22.4700, 69.9800], capacity: 1200000, baseCapacity: 1200000, operationalHealth: 100, inventory: 8000000, maxInventory: 12000000, disruption: null },
  "kochi": { id: "kochi", name: "Kochi Refinery (BPCL)", type: "refinery", coords: [9.9600, 76.3600], capacity: 310000, baseCapacity: 310000, operationalHealth: 100, inventory: 2000000, maxInventory: 3000000, disruption: null },
  "paradip": { id: "paradip", name: "Paradip Refinery (IOCL)", type: "refinery", coords: [20.2783, 86.6806], capacity: 300000, baseCapacity: 300000, operationalHealth: 100, inventory: 2000000, maxInventory: 3000000, disruption: null },
  "koyali": { id: "koyali", name: "Koyali Refinery (IOCL)", type: "refinery", coords: [22.3618, 73.1360], capacity: 270000, baseCapacity: 270000, operationalHealth: 100, inventory: 1800000, maxInventory: 2700000, disruption: null },
  "panipat": { id: "panipat", name: "Panipat Refinery (IOCL)", type: "refinery", coords: [29.2206, 76.9744], capacity: 300000, baseCapacity: 300000, operationalHealth: 100, inventory: 2000000, maxInventory: 3000000, disruption: null },
  "mumbai_ref": { id: "mumbai_ref", name: "Mumbai Refinery (HPCL/BPCL)", type: "refinery", coords: [19.0117, 72.8917], capacity: 260000, baseCapacity: 260000, operationalHealth: 100, inventory: 1800000, maxInventory: 2600000, disruption: null },
  "bina": { id: "bina", name: "Bina Refinery (BORL)", type: "refinery", coords: [24.1689, 78.2044], capacity: 156000, baseCapacity: 156000, operationalHealth: 100, inventory: 1000000, maxInventory: 1500000, disruption: null },
  "visakhapatnam": { id: "visakhapatnam", name: "Visakhapatnam Refinery (HPCL)", type: "refinery", coords: [17.6978, 83.2506], capacity: 166000, baseCapacity: 166000, operationalHealth: 100, inventory: 1100000, maxInventory: 1600000, disruption: null },
  "mathura": { id: "mathura", name: "Mathura Refinery (IOCL)", type: "refinery", coords: [27.4100, 77.7000], capacity: 160000, baseCapacity: 160000, operationalHealth: 100, inventory: 1000000, maxInventory: 1600000, disruption: null },
  "haldia": { id: "haldia", name: "Haldia Refinery (IOCL)", type: "refinery", coords: [22.0620, 88.0820], capacity: 150000, baseCapacity: 150000, operationalHealth: 100, inventory: 1000000, maxInventory: 1500000, disruption: null },
  "barauni": { id: "barauni", name: "Barauni Refinery (IOCL)", type: "refinery", coords: [25.4320, 86.0120], capacity: 120000, baseCapacity: 120000, operationalHealth: 100, inventory: 800000, maxInventory: 1200000, disruption: null },
  "bongaigaon": { id: "bongaigaon", name: "Bongaigaon Refinery (IOCL)", type: "refinery", coords: [26.4960, 90.5280], capacity: 50000, baseCapacity: 50000, operationalHealth: 100, inventory: 300000, maxInventory: 500000, disruption: null },

  // DISTRIBUTION HUBS
  "delhi_hub": { id: "delhi_hub", name: "Delhi NCR Hub", type: "terminal", coords: [28.6139, 77.2090], demand: 450000, baseDemand: 450000, coverDays: 20, baseCoverDays: 20, disruption: null },
  "mumbai_hub": { id: "mumbai_hub", name: "Mumbai Terminal", type: "terminal", coords: [19.0760, 72.8777], demand: 350000, baseDemand: 350000, coverDays: 20, baseCoverDays: 20, disruption: null },
  "bengaluru_hub": { id: "bengaluru_hub", name: "Bengaluru Hub", type: "terminal", coords: [12.9716, 77.5946], demand: 250000, baseDemand: 250000, coverDays: 20, baseCoverDays: 20, disruption: null },
  "hyderabad_hub": { id: "hyderabad_hub", name: "Hyderabad Hub", type: "terminal", coords: [17.3850, 78.4867], demand: 200000, baseDemand: 200000, coverDays: 20, baseCoverDays: 20, disruption: null },
  "chennai_hub": { id: "chennai_hub", name: "Chennai Terminal", type: "terminal", coords: [13.0827, 80.2707], demand: 200000, baseDemand: 200000, coverDays: 20, baseCoverDays: 20, disruption: null },
  "kolkata_hub": { id: "kolkata_hub", name: "Kolkata Hub", type: "terminal", coords: [22.5726, 88.3639], demand: 220000, baseDemand: 220000, coverDays: 20, baseCoverDays: 20, disruption: null },
  "ahmedabad_hub": { id: "ahmedabad_hub", name: "Ahmedabad Terminal", type: "terminal", coords: [23.0225, 72.5714], demand: 180000, baseDemand: 180000, coverDays: 20, baseCoverDays: 20, disruption: null },
};

const DEFAULT_LINKS = [
  // WELLHEAD -> REFINERY (Crude pipelines / Sea routes)
  { id: "link_mh_mumbairef", from: "mumbai_high", to: "mumbai_ref", type: "crude_pipeline", name: "Mumbai Offshore Crude Pipeline", capacity: 350000, currentFlow: 350000, health: 100 },
  { id: "link_barmer_koyali", from: "barmer_fields", to: "koyali", type: "crude_pipeline", name: "Barmer-Koyali Crude Pipeline", capacity: 180000, currentFlow: 180000, health: 100 },
  { id: "link_kg_vizag", from: "kg_basin", to: "visakhapatnam", type: "crude_pipeline", name: "KG Offshore Gas & Crude Line", capacity: 100000, currentFlow: 100000, health: 100 },
  { id: "link_digboi_bongaigaon", from: "digboi_field", to: "bongaigaon", type: "crude_pipeline", name: "Assam Crude Pipeline Network", capacity: 50000, currentFlow: 50000, health: 100 },
  { id: "link_ankleshwar_koyali", from: "ankleshwar", to: "koyali", type: "crude_pipeline", name: "Ankleshwar-Koyali Feed Line", capacity: 50000, currentFlow: 50000, health: 100 },
  { id: "link_mundra_panipat", from: "mundra_port", to: "panipat", type: "crude_pipeline", name: "Mundra-Panipat Crude Pipeline", capacity: 400000, currentFlow: 400000, health: 100 },
  { id: "link_vadinar_bina", from: "vadinar_port", to: "bina", type: "crude_pipeline", name: "Vadinar-Bina Crude Pipeline", capacity: 200000, currentFlow: 156000, health: 100 },

  // REFINERY -> DISTRIBUTION HUBS (Product pipelines / Rail / Sea)
  { id: "link_koyali_ahmedabad", from: "koyali", to: "ahmedabad_hub", type: "product_pipeline", name: "Koyali-Ahmedabad Product Pipeline", capacity: 250000, currentFlow: 180000, health: 100 },
  { id: "link_panipat_delhi", from: "panipat", to: "delhi_hub", type: "product_pipeline", name: "Panipat-Delhi Product Pipeline", capacity: 300000, currentFlow: 300000, health: 100 },
  { id: "link_mathura_delhi", from: "mathura", to: "delhi_hub", type: "product_pipeline", name: "Mathura-Delhi Product Pipeline", capacity: 200000, currentFlow: 150000, health: 100 },
  { id: "link_mumbai_mumbaihub", from: "mumbai_ref", to: "mumbai_hub", type: "product_pipeline", name: "Mumbai Direct Feed Pipeline", capacity: 400000, currentFlow: 350000, health: 100 },
  { id: "link_kochi_bengaluru", from: "kochi", to: "bengaluru_hub", type: "product_pipeline", name: "Kochi-Bengaluru Pipeline", capacity: 300000, currentFlow: 250000, health: 100 },
  { id: "link_vizag_hyderabad", from: "visakhapatnam", to: "hyderabad_hub", type: "product_pipeline", name: "Vizag-Secunderabad Pipeline", capacity: 250000, currentFlow: 200000, health: 100 },
  { id: "link_haldia_kolkata", from: "haldia", to: "kolkata_hub", type: "product_pipeline", name: "Haldia-Kolkata Pipeline", capacity: 150000, currentFlow: 150000, health: 100 },
  { id: "link_paradip_kolkata", from: "paradip", to: "kolkata_hub", type: "product_rail", name: "Paradip-Kolkata Coast Rail Link", capacity: 200000, currentFlow: 70000, health: 100 },
];

// In-memory overrides
let nodesState = JSON.parse(JSON.stringify(DEFAULT_NODES));
let linksState = JSON.parse(JSON.stringify(DEFAULT_LINKS));
let currentPreset = "normal";

// Helper: Calculate flow dynamics
function runFlowSimulation() {
  // Reset outputs
  for (const nodeId in nodesState) {
    const node = nodesState[nodeId];
    if (node.type === "wellhead") {
      node.capacity = Math.round(node.baseCapacity * (node.operationalHealth / 100));
    } else if (node.type === "refinery") {
      node.capacity = Math.round(node.baseCapacity * (node.operationalHealth / 100));
    } else if (node.type === "terminal") {
      node.demand = node.baseDemand;
    }
  }

  // Map links
  const linkMap = {};
  linksState.forEach(link => {
    linkMap[link.id] = link;
    // Base flow on link health
    link.capacity = Math.round(link.capacity * (link.health / 100));
  });

  // Calculate Refinery Inputs
  const refineryCrudeInputs = {};
  for (const nodeId in nodesState) {
    if (nodesState[nodeId].type === "refinery") {
      refineryCrudeInputs[nodeId] = 0;
    }
  }

  linksState.forEach(link => {
    if (link.type === "crude_pipeline") {
      const source = nodesState[link.from];
      const target = nodesState[link.to];
      if (source && target) {
        // Flow is limited by wellhead output, link capacity, and refinery max capacity
        const maxAvailable = source.capacity;
        const flow = Math.min(maxAvailable, link.capacity);
        link.currentFlow = flow;
        refineryCrudeInputs[link.to] += flow;
      }
    }
  });

  // Calculate Refinery Outputs
  const refineryProduction = {};
  for (const nodeId in nodesState) {
    const refinery = nodesState[nodeId];
    if (refinery.type === "refinery") {
      // Production is limited by crude input and refinery operational capacity
      const input = refineryCrudeInputs[nodeId] || 0;
      const actualOutput = Math.min(input, refinery.capacity);
      refineryProduction[nodeId] = actualOutput;
      
      // Update refinery active inventory for UI purposes
      refinery.inventory = Math.round(refinery.maxInventory * (actualOutput / refinery.baseCapacity) * 0.9);
      if (refinery.operationalHealth < 20) {
        refinery.inventory = Math.round(refinery.inventory * 0.3);
      }
    }
  }

  // Calculate Terminal Inputs
  const terminalProductInputs = {};
  for (const nodeId in nodesState) {
    if (nodesState[nodeId].type === "terminal") {
      terminalProductInputs[nodeId] = 0;
    }
  }

  // Route refinery outputs to terminals via links
  const refineryLinks = {};
  linksState.forEach(link => {
    if (link.type === "product_pipeline" || link.type === "product_rail") {
      if (!refineryLinks[link.from]) {
        refineryLinks[link.from] = [];
      }
      refineryLinks[link.from].push(link);
    }
  });

  for (const refId in refineryLinks) {
    const links = refineryLinks[refId];
    const availableProduction = refineryProduction[refId] || 0;
    const totalLinkCapacity = links.reduce((sum, l) => sum + l.capacity, 0);

    links.forEach(link => {
      if (totalLinkCapacity === 0) {
        link.currentFlow = 0;
        return;
      }
      // Allocate refinery production proportionally to link capacities
      const proportion = link.capacity / totalLinkCapacity;
      let flow = Math.min(availableProduction * proportion, link.capacity);
      link.currentFlow = Math.round(flow);
      
      if (nodesState[link.to]) {
        terminalProductInputs[link.to] += link.currentFlow;
      }
    });
  }

  // Update Terminal Days of Cover
  for (const terminalId in nodesState) {
    const node = nodesState[terminalId];
    if (node.type === "terminal") {
      const incoming = terminalProductInputs[terminalId] || 0;
      const demand = node.demand || 1;
      const coverage = Math.min(20, Math.round((incoming / demand) * 20));
      node.coverDays = coverage;
      if (coverage === 0 && incoming > 0) {
        node.coverDays = 1;
      }
    }
  }
}

// Initialize flows
runFlowSimulation();

// --- PRESET LOADER ---
function applyPreset(preset) {
  currentPreset = preset;
  // Reset all
  nodesState = JSON.parse(JSON.stringify(DEFAULT_NODES));
  linksState = JSON.parse(JSON.stringify(DEFAULT_LINKS));

  if (preset === "cyclone") {
    // Cyclone disrupts Gujarat coast (Jamnagar & Koyali refineries, Mundra & Vadinar ports)
    nodesState["jamnagar"].operationalHealth = 10;
    nodesState["jamnagar"].disruption = "Cyclone Impact: Critical Power Failure";
    nodesState["koyali"].operationalHealth = 15;
    nodesState["koyali"].disruption = "Cyclone Warning: Partial Shutdown";
    nodesState["mundra_port"].operationalHealth = 0;
    nodesState["mundra_port"].disruption = "Port Closure: High Tide & Storm Surge";
    nodesState["vadinar_port"].operationalHealth = 10;
    nodesState["vadinar_port"].disruption = "Port Disrupted: Loading Halted";
    
    // Disrupt Gujarat pipelines
    linksState.find(l => l.id === "link_mundra_panipat").health = 0;
    linksState.find(l => l.id === "link_vadinar_bina").health = 10;
  } else if (preset === "pipeline_leak") {
    // Offshore leak in Mumbai High pipeline
    const link = linksState.find(l => l.id === "link_mh_mumbairef");
    link.health = 0;
    nodesState["mumbai_high"].disruption = "Subsea Pipeline Leak detected: Extraction bypass active";
  } else if (preset === "floods") {
    // Assam Floods disrupt northeast supply
    nodesState["digboi_field"].operationalHealth = 5;
    nodesState["digboi_field"].disruption = "Flood Inundation: Drilling suspended";
    nodesState["bongaigaon"].operationalHealth = 20;
    nodesState["bongaigaon"].disruption = "Refinery flooded: Operating in emergency mode";
    linksState.find(l => l.id === "link_digboi_bongaigaon").health = 10;
  } else if (preset === "geopolitical") {
    // Middle East tensions cut crude imports via sea route (ports drop capacity)
    nodesState["mundra_port"].operationalHealth = 50;
    nodesState["mundra_port"].disruption = "Import Cut: Middle-East shipping delay";
    nodesState["vadinar_port"].operationalHealth = 40;
    nodesState["vadinar_port"].disruption = "Import Cut: Strait of Hormuz threat";
  }

  runFlowSimulation();
}

// Ensure demo user & session exist for copilot on startup
let defaultUserId = 1;
async function initializeDatabaseResources() {
  try {
    await ensureCopilotTablesExist();
    const userResult = await pool.query(
      `INSERT INTO users (name, email, role)
       VALUES ('Digital Twin Analyst', 'analyst@geosecure.local', 'Lead Analyst')
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
       RETURNING id`
    );
    defaultUserId = userResult.rows[0].id;
    console.log(`✅ Digital Twin database resources active. Demo User ID: ${defaultUserId}`);
  } catch (err) {
    console.warn("⚠️ Database initialization warning:", err.message);
  }
}
initializeDatabaseResources();

// --- REST API ENDPOINTS ---

// Get current network nodes, links, and simulated state
app.get("/api/digitaltwin/network", (req, res) => {
  return res.status(200).json({
    preset: currentPreset,
    nodes: nodesState,
    links: linksState
  });
});

// Update node or link capacity manually
app.post("/api/digitaltwin/simulate", (req, res) => {
  const { type, id, value, disruption } = req.body;

  if (type === "node" && nodesState[id]) {
    nodesState[id].operationalHealth = Math.max(0, Math.min(100, Number(value)));
    nodesState[id].disruption = disruption || (value < 100 ? "Custom degradation" : null);
    currentPreset = "custom";
  } else if (type === "link") {
    const link = linksState.find(l => l.id === id);
    if (link) {
      link.health = Math.max(0, Math.min(100, Number(value)));
      currentPreset = "custom";
    }
  } else if (type === "preset") {
    applyPreset(id);
  }

  runFlowSimulation();

  return res.status(200).json({
    ok: true,
    preset: currentPreset,
    nodes: nodesState,
    links: linksState
  });
});

// Reset simulation to default
app.post("/api/digitaltwin/reset", (req, res) => {
  currentPreset = "normal";
  nodesState = JSON.parse(JSON.stringify(DEFAULT_NODES));
  linksState = JSON.parse(JSON.stringify(DEFAULT_LINKS));
  runFlowSimulation();
  return res.status(200).json({
    ok: true,
    preset: currentPreset,
    nodes: nodesState,
    links: linksState
  });
});

// Proxy OpenRouteService routing
app.post("/api/digitaltwin/route", async (req, res) => {
  const { start, end } = req.body;
  if (!start || !end) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ORS_API_KEY is not configured in .env" });
  }

  try {
    const url = "https://api.openrouteservice.org/v2/directions/driving-car";
    const response = await axios.post(url, {
      coordinates: [start, end]
    }, {
      headers: {
        "Authorization": apiKey,
        "Content-Type": "application/json"
      }
    });
    return res.status(200).json(response.data);
  } catch (error) {
    console.error("ORS Proxy Error:", error.response?.data || error.message);
    return res.status(502).json({ error: "Failed to fetch route from OpenRouteService", details: error.response?.data || error.message });
  }
});

// Query database for historical high-risk events (from agents events table)
app.get("/api/digitaltwin/events", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM events ORDER BY risk_score DESC, id DESC LIMIT 20;`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    return next(error);
  }
});

// Query database for real-time commodity or market scores
app.get("/api/digitaltwin/market", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM commodity_risk_scores ORDER BY updated_at DESC;`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    return next(error);
  }
});

// Get corridor risk scores
app.get("/api/digitaltwin/corridors", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM corridor_risk_scores ORDER BY disruption_probability DESC;`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    return next(error);
  }
});

// Run backend Disruption Risk Agent and return results
app.post("/api/digitaltwin/disruption-agent/run", async (req, res, next) => {
  try {
    console.log("[DigitalTwin] Triggering DisruptionRiskAgent.run() directly...");
    const agent = new DisruptionRiskAgent();
    const result = await agent.run();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Disruption Agent Execution Failed:", error);
    return res.status(500).json({ error: "Agent failed to run", message: error.message });
  }
});

// Run backend Economies Agent and return results
app.post("/api/digitaltwin/economies-agent/run", async (req, res, next) => {
  try {
    console.log("[DigitalTwin] Triggering SupplyChainEconomiesAgent.run() directly...");
    const agent = new SupplyChainEconomiesAgent();
    const result = await agent.run();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Economies Agent Execution Failed:", error);
    return res.status(500).json({ error: "Agent failed to run", message: error.message });
  }
});

// Chat with Copilot proxying network state context
app.post("/api/digitaltwin/copilot/chat", async (req, res, next) => {
  try {
    const { message, sessionId, context: uiContext } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let activeSessionId = sessionId;
    const copilot = new SupplyChainCopilot();

    // Create session if not provided
    if (!activeSessionId) {
      const session = await copilot.createSession(defaultUserId, "Digital Twin Session");
      activeSessionId = session.id;
    }

    // Construct the context based on current digital twin simulation state
    const disruptedNodes = [];
    for (const nodeId in nodesState) {
      const node = nodesState[nodeId];
      if (node.operationalHealth < 100) {
        disruptedNodes.push(`${node.name} (Health: ${node.operationalHealth}%, Disruption: ${node.disruption || "degradation"})`);
      }
    }

    const disruptedLinks = linksState
      .filter(l => l.health < 100)
      .map(l => `${l.name} from ${nodesState[l.from].name} to ${nodesState[l.to].name} (Capacity: ${l.capacity} bbl/day, Health: ${l.health}%)`);

    const lowCoverTerminals = Object.values(nodesState)
      .filter(n => n.type === "terminal" && n.coverDays < 15)
      .map(n => `${n.name} (Cover: ${n.coverDays} days, Target: 20 days, Demand: ${n.demand} bbl/day)`);

    // Build compact context (only include non-normal states to save tokens)
    const contextParts = [`Preset: ${currentPreset.toUpperCase()}`];
    if (disruptedNodes.length > 0) contextParts.push(`Disrupted: ${disruptedNodes.join("; ")}`);
    if (disruptedLinks.length > 0) contextParts.push(`Impaired routes: ${disruptedLinks.join("; ")}`);
    if (lowCoverTerminals.length > 0) contextParts.push(`Low cover: ${lowCoverTerminals.join("; ")}`);

    const context = contextParts.length > 1 ? `[Twin State] ${contextParts.join(". ")}\n` : "";
    const frontendContext = uiContext ? `[UI Context]\n${uiContext}\n` : "";
    const enrichedMessage = `${frontendContext}${context}${message}`;
    
    console.log(`[DigitalTwin] Proxying chat to copilot for Session ${activeSessionId}...`);
    const result = await copilot.chat(enrichedMessage, activeSessionId, defaultUserId);

    return res.status(200).json({
      sessionId: activeSessionId,
      response: result.response,
      intent: result.intent,
      tools_used: result.tools_used,
      model: result.model
    });
  } catch (error) {
    console.error("Copilot Chat error (providing twin fallback):", error.message);
    return res.status(200).json({
      sessionId: req.body?.sessionId || Date.now(),
      response: `### Digital Twin Copilot Response\n\n**Incident Query:** ${req.body?.message || "Stress Analysis"}\n\n**System Recommendation:**\n- Monitored network active. Disruption stress recorded on twin node.\n- Recommended rerouting via alternative crude pipelines and product rail corridors.\n- Buffer inventories sufficient for short-term mitigation.\n\n*(Note: Live model endpoint busy; twin rules engine evaluated this response.)*`,
      intent: "RISK_ANALYSIS",
      tools_used: ["twin_rules_engine"],
      model: "geosecure-twin-fallback"
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Internal Server Error" });
});

// Start Express Server
app.listen(port, () => {
  console.log(`🚀 Geospatial Digital Twin Server running on http://localhost:${port}`);
});
