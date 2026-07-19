// Global state variables
let map;
let nodesData = {};
let linksData = [];
let activePreset = "normal";
let selectedNodeId = null;
let refineryChartInstance = null;

// Map layers and groups
let markersGroup;
let pipelinesGroup;

// API Base URL (runs on port 8085)
const API_BASE = "";

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupTabs();
  fetchNetworkState();
  fetchActiveAlerts();
  fetchCorridorRisks();

  // Event listeners
  document.getElementById("scenarioPreset").addEventListener("change", (e) => {
    applyPreset(e.target.value);
  });

  document.getElementById("resetSimBtn").addEventListener("click", () => {
    resetSimulation();
  });

  document.getElementById("applyNodeChangesBtn").addEventListener("click", () => {
    applyNodeChanges();
  });

  document.getElementById("clearDisruptionBtn").addEventListener("click", () => {
    clearNodeDisruption();
  });

  document.getElementById("runDisruptionAgentBtn").addEventListener("click", () => {
    runAIEventAgent("disruption");
  });

  document.getElementById("runEconomiesAgentBtn").addEventListener("click", () => {
    runAIEventAgent("economies");
  });

  document.getElementById("sendChatBtn").addEventListener("click", () => {
    sendChatMessage();
  });

  document.getElementById("chat-input-field").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendChatMessage();
    }
  });
});

// Initialize Leaflet Map
function initMap() {
  // Center map on India
  map = L.map("map-container", {
    center: [21.7679, 78.8718],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10,
    zoomControl: true,
    attributionControl: false
  });

  // Dark Theme Tiles (CartoDB Dark Matter)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  pipelinesGroup = L.layerGroup().addTo(map);
}

// Tab switcher logic
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Remove active from all tabs
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      // Set active
      tab.classList.add("active");
      const targetTab = tab.getAttribute("data-tab");
      document.getElementById(targetTab).classList.add("active");
    });
  });
}

// Fetch network state from backend simulation
async function fetchNetworkState() {
  try {
    const response = await fetch(`${API_BASE}/api/digitaltwin/network`);
    if (!response.ok) throw new Error("Failed to fetch network state");

    const data = await response.json();
    nodesData = data.nodes;
    linksData = data.links;
    activePreset = data.preset;

    // Update preset selector value without triggering event
    document.getElementById("scenarioPreset").value = activePreset;

    renderNetwork();
    calculateSystemMetrics();
    updateCharts();
  } catch (error) {
    console.error("Network Fetch Error:", error);
    showTickerMessage("System state retrieval failed. Checking backend connection...", true);
  }
}

// Render nodes and pipelines on Leaflet map
function renderNetwork() {
  // Clear old markers/polylines
  markersGroup.clearLayers();
  pipelinesGroup.clearLayers();

  // 1. Draw Pipeline polylines
  linksData.forEach(link => {
    const fromNode = nodesData[link.from];
    const toNode = nodesData[link.to];

    if (fromNode && toNode) {
      const startCoords = fromNode.coords;
      const endCoords = toNode.coords;

      // Determine pipeline color/animation based on type and health
      let strokeColor = "rgba(14, 165, 233, 0.6)"; // Default refined product
      let weight = 4;

      if (link.type === "crude_pipeline") {
        strokeColor = "rgba(245, 158, 11, 0.7)"; // Crude is orange
        weight = 5;
      } else if (link.type === "product_rail") {
        strokeColor = "rgba(139, 92, 246, 0.5)"; // Rail is purple
        weight = 3;
      }

      if (link.health === 0) {
        strokeColor = "rgba(244, 63, 94, 0.4)"; // Broken pipeline is faint red
      } else if (link.health < 100) {
        strokeColor = "rgba(245, 158, 11, 0.5)"; // Weak pipeline is amber
      }

      // Animated flowing dashes
      const pathOptions = {
        color: strokeColor,
        weight: weight,
        opacity: 0.8,
        dashArray: link.health > 0 ? "8, 12" : null,
        className: link.health > 0 ? "pipeline-flow" : "", // triggers CSS keyframe animation
        lineJoin: "round"
      };

      const polyline = L.polyline([startCoords, endCoords], pathOptions);

      // Tooltip/popup info
      const flowRate = link.health > 0 ? `${link.currentFlow.toLocaleString()} bbl/d` : "HALTED (0 bbl/d)";
      const statusTxt = link.health === 100 ? "Healthy" : (link.health === 0 ? "Severed" : `Degraded (${link.health}% capacity)`);
      polyline.bindTooltip(`
        <strong>${link.name}</strong><br/>
        Flow Rate: ${flowRate}<br/>
        Capacity: ${link.capacity.toLocaleString()} bbl/d<br/>
        Status: ${statusTxt}
      `);

      polyline.addTo(pipelinesGroup);
    }
  });

  // 2. Plot assets markers
  for (const nodeId in nodesData) {
    const node = nodesData[nodeId];

    // Determine custom class styling based on status
    const isDisrupted = node.operationalHealth < 100 || node.disruption;
    const typeClass = `map-marker-${node.type}`;
    const statusClass = isDisrupted ? "map-marker-disrupted" : "";

    // Custom DIV icon
    const icon = L.divIcon({
      className: `map-marker ${typeClass} ${statusClass}`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker(node.coords, { icon: icon });

    // Tooltip details
    let detailsHtml = `<strong>${node.name}</strong><br/>Type: ${node.type.toUpperCase()}<br/>`;
    if (node.type === "wellhead") {
      detailsHtml += `Production: ${node.capacity.toLocaleString()} bbl/d<br/>`;
    } else if (node.type === "refinery") {
      detailsHtml += `Throughput: ${node.capacity.toLocaleString()} bbl/d<br/>`;
      detailsHtml += `Inventory: ${node.inventory.toLocaleString()} bbl (${Math.round((node.inventory / node.maxInventory) * 100)}%)<br/>`;
    } else if (node.type === "terminal") {
      detailsHtml += `Daily Demand: ${node.demand.toLocaleString()} bbl/d<br/>`;
      detailsHtml += `Supply Sufficiency: <strong class="${node.coverDays < 10 ? 'text-danger' : (node.coverDays < 15 ? 'text-warning' : 'text-success')}">${node.coverDays} days</strong><br/>`;
    }

    detailsHtml += `Health: ${node.operationalHealth}%<br/>`;
    if (node.disruption) {
      detailsHtml += `<span class="text-danger">⚠️ ${node.disruption}</span>`;
    }

    marker.bindTooltip(detailsHtml, { direction: "top", offset: [0, -10] });

    // Handle marker selection clicks
    marker.on("click", () => {
      selectNode(node.id);
    });

    marker.addTo(markersGroup);
  }
}

// Select asset node and load into panel controls
function selectNode(nodeId) {
  selectedNodeId = nodeId;
  const node = nodesData[nodeId];

  // Remove hidden state and empty layout
  document.getElementById("selected-node-panel").classList.remove("empty");
  document.querySelector(".node-details-content").classList.remove("hidden");
  document.querySelector(".empty-state").classList.add("hidden");

  // Populate panel fields
  const badge = document.getElementById("node-badge");
  badge.textContent = node.type.toUpperCase();
  badge.className = `badge ${node.type}`;

  document.getElementById("node-title").textContent = node.name;

  const healthTxt = document.getElementById("node-health-txt");
  healthTxt.textContent = `${node.operationalHealth}%`;
  healthTxt.className = node.operationalHealth < 50 ? "text-danger" : (node.operationalHealth < 90 ? "text-warning" : "text-success");

  document.getElementById("node-health-slider").value = node.operationalHealth;

  const rateLabel = document.getElementById("node-rate-label");
  const rateTxt = document.getElementById("node-rate-txt");
  if (node.type === "wellhead") {
    rateLabel.textContent = "Production capacity:";
    rateTxt.textContent = `${node.capacity.toLocaleString()} bbl/d`;
  } else if (node.type === "refinery") {
    rateLabel.textContent = "Refining throughput:";
    rateTxt.textContent = `${node.capacity.toLocaleString()} bbl/d`;
  } else if (node.type === "terminal") {
    rateLabel.textContent = "Downstream Demand:";
    rateTxt.textContent = `${node.demand.toLocaleString()} bbl/d`;
  }

  document.getElementById("node-disruption-desc").value = node.disruption || "";
}

// Post Manual updates or sliders stress changes to backend
async function applyNodeChanges() {
  if (!selectedNodeId) return;

  const healthVal = parseInt(document.getElementById("node-health-slider").value, 10);
  const disruptionDesc = document.getElementById("node-disruption-desc").value.trim();

  try {
    const response = await fetch(`${API_BASE}/api/digitaltwin/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "node",
        id: selectedNodeId,
        value: healthVal,
        disruption: healthVal < 100 ? (disruptionDesc || "Degraded State") : null
      })
    });

    if (!response.ok) throw new Error("Failed to post stress simulation");

    const data = await response.json();
    nodesData = data.nodes;
    linksData = data.links;
    activePreset = data.preset;

    // Refresh display
    renderNetwork();
    calculateSystemMetrics();
    updateCharts();

    // Update panel active stats
    selectNode(selectedNodeId);
    showTickerMessage(`Applied stress override on ${nodesData[selectedNodeId].name}. Downstream recalculation done.`);
  } catch (error) {
    console.error("Stress application failed:", error);
  }
}

// Clear active stresses
async function clearNodeDisruption() {
  if (!selectedNodeId) return;

  document.getElementById("node-health-slider").value = 100;
  document.getElementById("node-disruption-desc").value = "";

  await applyNodeChanges();
}

// Trigger regional presets from dropdown
async function applyPreset(presetId) {
  try {
    const response = await fetch(`${API_BASE}/api/digitaltwin/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "preset",
        id: presetId
      })
    });

    if (!response.ok) throw new Error("Failed to apply preset");

    const data = await response.json();
    nodesData = data.nodes;
    linksData = data.links;
    activePreset = data.preset;

    renderNetwork();
    calculateSystemMetrics();
    updateCharts();

    // Reset selection panel
    if (selectedNodeId) {
      selectNode(selectedNodeId);
    }

    showTickerMessage(`Activated regional simulation preset: ${presetId.toUpperCase()}. Flow paths disrupted.`);
  } catch (error) {
    console.error("Preset activation failed:", error);
  }
}

// Reset entire simulation to standard operations
async function resetSimulation() {
  try {
    const response = await fetch(`${API_BASE}/api/digitaltwin/reset`, {
      method: "POST"
    });

    if (!response.ok) throw new Error("Reset failed");

    const data = await response.json();
    nodesData = data.nodes;
    linksData = data.links;
    activePreset = data.preset;

    document.getElementById("scenarioPreset").value = "normal";

    renderNetwork();
    calculateSystemMetrics();
    updateCharts();

    // Hide panel
    document.getElementById("selected-node-panel").classList.add("empty");
    document.querySelector(".node-details-content").classList.add("hidden");
    document.querySelector(".empty-state").classList.remove("hidden");
    selectedNodeId = null;

    showTickerMessage("Simulation reset. Standard operational capacities restored.");
  } catch (error) {
    console.error("Reset failed:", error);
  }
}

// Dynamic mathematical modeling calculations for KPI blocks
function calculateSystemMetrics() {
  let totalRefineriesCapacity = 0;
  let activeRefineriesThroughput = 0;
  let totalTerminalCoverDays = 0;
  let totalTerminalCount = 0;
  let disruptedNodeCount = 0;

  for (const nodeId in nodesData) {
    const node = nodesData[nodeId];
    if (node.type === "refinery") {
      totalRefineriesCapacity += node.baseCapacity;
      activeRefineriesThroughput += node.capacity; // this drops when health reduces
      if (node.operationalHealth < 100) disruptedNodeCount++;
    } else if (node.type === "terminal") {
      totalTerminalCoverDays += node.coverDays;
      totalTerminalCount++;
      if (node.coverDays < 15) disruptedNodeCount++;
    } else if (node.type === "wellhead") {
      if (node.operationalHealth < 100) disruptedNodeCount++;
    }
  }

  // Calculate Average Refinery Capacity
  const refineryUtilization = Math.round((activeRefineriesThroughput / totalRefineriesCapacity) * 100);

  // Calculate Average Cover
  const avgCover = Math.round(totalTerminalCoverDays / (totalTerminalCount || 1));

  // Network Risk Index (scaled 0-100)
  const riskIndex = Math.min(100, disruptedNodeCount * 12 + (activePreset !== "normal" ? 15 : 0));
  const riskTxt = riskIndex < 30 ? "LOW" : (riskIndex < 60 ? "MODERATE" : "CRITICAL");

  // Update DOM KPI values
  const riskKpi = document.getElementById("kpi-risk");
  riskKpi.querySelector(".kpi-value").innerHTML = `${riskIndex}<span class="kpi-unit">/100</span>`;
  riskKpi.querySelector(".kpi-sub").textContent = `Level: ${riskTxt}`;
  riskKpi.querySelector(".kpi-sub").className = `kpi-sub ${riskIndex < 30 ? 'text-success' : (riskIndex < 60 ? 'text-warning' : 'text-danger')}`;

  const capKpi = document.getElementById("kpi-capacity");
  capKpi.querySelector(".kpi-value").innerHTML = `${refineryUtilization}<span class="kpi-unit">%</span>`;
  capKpi.querySelector(".kpi-sub").textContent = `Active: ${activeRefineriesThroughput.toLocaleString()} bbl/d`;

  const coverKpi = document.getElementById("kpi-cover");
  coverKpi.querySelector(".kpi-value").innerHTML = `${avgCover}<span class="kpi-unit">days</span>`;
  coverKpi.querySelector(".kpi-sub").textContent = `Min safety target: 15 days`;
  coverKpi.querySelector(".kpi-sub").className = `kpi-sub ${avgCover < 12 ? 'text-danger' : (avgCover < 16 ? 'text-warning' : 'text-success')}`;
}

// Fetch active events database entries for ticker and live risk scores
async function fetchActiveAlerts() {
  try {
    const res = await fetch(`${API_BASE}/api/digitaltwin/events`);
    if (!res.ok) throw new Error("Failed to fetch events");
    const events = await res.json();

    if (events && events.length > 0) {
      const tickerBox = document.getElementById("ticker-messages");
      tickerBox.innerHTML = "";
      const text = events.map(e => `[${e.risk_level.toUpperCase()} RISK] ${e.event_type || 'INCIDENT'}: ${e.summary || 'Trade flow disruption reports'}`).join(" &nbsp;&nbsp; | &nbsp;&nbsp; ");
      tickerBox.innerHTML = `<span>${text}</span>`;
    }
  } catch (error) {
    console.error("Alert ticker update failed:", error);
  }
}

// Fetch commodities for Brent Crude benchmark card
async function fetchCorridorRisks() {
  try {
    const res = await fetch(`${API_BASE}/api/digitaltwin/market`);
    const commodities = res.ok ? await res.json() : [];

    const brent = commodities.find(c => c.commodity === "Brent Crude") || { disruption_probability: 10, risk_level: "LOW" };

    // Update Benchmark Card
    const benchmarkKpi = document.getElementById("kpi-price");
    benchmarkKpi.querySelector(".kpi-value").innerHTML = `$84.20<span class="kpi-unit">/bbl</span>`; // default or live brent crude price
    benchmarkKpi.querySelector(".kpi-sub").textContent = `Risk Probability: ${brent.disruption_probability}% (${brent.risk_level})`;
    benchmarkKpi.querySelector(".kpi-sub").className = `kpi-sub ${brent.risk_level === 'CRITICAL' || brent.risk_level === 'HIGH' ? 'text-danger' : 'text-success'}`;

    // Corridor table
    const corrRes = await fetch(`${API_BASE}/api/digitaltwin/corridors`);
    if (corrRes.ok) {
      const corridors = await corrRes.json();
      const body = document.getElementById("corridor-scores-body");
      body.innerHTML = "";

      if (corridors.length === 0) {
        body.innerHTML = `<tr><td colspan="3" class="text-center">No active corridor records</td></tr>`;
        return;
      }

      corridors.forEach(c => {
        const lvlClass = c.risk_level === "HIGH" || c.risk_level === "CRITICAL" ? "text-danger" : (c.risk_level === "MEDIUM" ? "text-warning" : "text-success");
        body.innerHTML += `
          <tr>
            <td><strong>${c.corridor_name}</strong></td>
            <td>${c.disruption_probability}%</td>
            <td class="${lvlClass}">${c.risk_level}</td>
          </tr>
        `;
      });
    }
  } catch (error) {
    console.error("Corridor risks fetching failed:", error);
  }
}

// Chart.js render horizontal bar graphs showing refinery capacities
function updateCharts() {
  const refineries = [];
  const capacities = [];
  const currentHealth = [];

  for (const nodeId in nodesData) {
    const node = nodesData[nodeId];
    if (node.type === "refinery") {
      refineries.push(node.name.replace(" Refinery", ""));
      capacities.push(node.baseCapacity / 1000); // in thousands
      currentHealth.push(node.operationalHealth);
    }
  }

  const ctx = document.getElementById("refineryChart").getContext("2d");

  if (refineryChartInstance) {
    refineryChartInstance.destroy();
  }

  refineryChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: refineries,
      datasets: [
        {
          label: "Current Operating Health (%)",
          data: currentHealth,
          backgroundColor: currentHealth.map(h => h < 50 ? "rgba(244, 63, 94, 0.6)" : (h < 90 ? "rgba(245, 158, 11, 0.6)" : "rgba(16, 185, 129, 0.6)")),
          borderColor: currentHealth.map(h => h < 50 ? "var(--accent-red)" : (h < 90 ? "var(--accent-orange)" : "var(--accent-green)")),
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: "#94a3b8", font: { family: "Outfit" } },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        x: {
          ticks: { color: "#94a3b8", font: { family: "Outfit" } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Execute background AI Disruption or Economies agent runs
async function runAIEventAgent(type) {
  const button = type === "disruption"
    ? document.getElementById("runDisruptionAgentBtn")
    : document.getElementById("runEconomiesAgentBtn");

  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Agent Run...`;

  showTickerMessage(`AI agent started in background. Analyzing geopolitical threat streams...`);

  try {
    const response = await fetch(`${API_BASE}/api/digitaltwin/${type}-agent/run`, {
      method: "POST"
    });

    if (!response.ok) throw new Error("Agent failed to run");
    const results = await response.json();

    // Reload UI lists
    await fetchActiveAlerts();
    await fetchCorridorRisks();

    showTickerMessage(`AI ${type.toUpperCase()} Agent execution complete. Threat data synchronized with local DB.`);
  } catch (error) {
    console.error("Agent execution failed:", error);
    showTickerMessage(`AI Agent failed. Check logs and API keys.`, true);
  } finally {
    button.disabled = false;
    button.innerHTML = originalHtml;
  }
}

// Connect to supply chain copilot for chat consultation
let chatSessionId = null;

async function sendChatMessage() {
  const input = document.getElementById("chat-input-field");
  const query = input.value.trim();
  if (!query) return;

  // Append user message
  appendMessage("user", "You", query);
  input.value = "";

  // Loader assistant message
  const loadMessageId = appendMessage("assistant", "Copilot", `<i class="fa-solid fa-ellipsis fa-fade"></i> AI is thinking...`);

  try {
    const response = await fetch(`${API_BASE}/api/digitaltwin/copilot/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: query,
        sessionId: chatSessionId
      })
    });

    if (!response.ok) throw new Error("Copilot network error");
    const result = await response.json();
    chatSessionId = result.sessionId;

    // Replace thinking message with real response
    updateMessage(loadMessageId, result.response);
  } catch (error) {
    console.error("Chat Failed:", error);
    updateMessage(loadMessageId, `<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Network error: Failed to connect to AI Copilot. Ensure Groq API Key is configured.</span>`);
  }
}

// Utility functions for UI logs
function appendMessage(senderType, senderName, text) {
  const container = document.getElementById("chat-messages-container");
  const messageId = "msg-" + Date.now();

  const icon = senderType === "user" ? "fa-user" : "fa-robot";
  const msgHtml = `
    <div class="message ${senderType}" id="${messageId}">
      <div class="message-sender"><i class="fa-solid ${icon}"></i> ${senderName}</div>
      <div class="message-text">${text}</div>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", msgHtml);
  container.scrollTop = container.scrollHeight;
  return messageId;
}

function updateMessage(messageId, newText) {
  const msgElement = document.getElementById(messageId);
  if (msgElement) {
    msgElement.querySelector(".message-text").innerHTML = newText.replace(/\n/g, "<br/>");
    const container = document.getElementById("chat-messages-container");
    container.scrollTop = container.scrollHeight;
  }
}

function showTickerMessage(msg, isError = false) {
  const ticker = document.getElementById("ticker-messages");
  const prefix = isError ? "[ERROR]" : "[SYSTEM]";
  const className = isError ? "text-danger" : "text-success";
  ticker.innerHTML = `<span class="${className}">${prefix} ${msg}</span>`;
}
