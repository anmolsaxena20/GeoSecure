import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ChatGroq } from "@langchain/groq";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const SEARCH_QUERY = [
  "supply chain",
  "logistics",
  "shipping",
  "freight",
  "port disruption",
  "sanctions",
  "war",
  "oil",
  "gas",
  "trade",
  "cyber attack",
  "airspace",
  "strike",
  "export restriction",
  "import restriction"
].join(" OR ");

const EXTRACTION_PROMPT = `You are an expert Supply Chain Risk Intelligence Analyst.

Analyze a single news article and return structured risk intelligence.

Choose exactly one event_type from this taxonomy:
- PORT_DISRUPTION
- AIRPORT_DISRUPTION
- CANAL_DISRUPTION
- TRADE_POLICY_CHANGE
- SANCTIONS
- TARIFF_CHANGE
- REGULATORY_CHANGE
- LABOR_STRIKE
- NATURAL_DISASTER
- EXTREME_WEATHER
- MILITARY_CONFLICT
- GEOPOLITICAL_EVENT
- CYBER_ATTACK
- INFRASTRUCTURE_FAILURE
- ENERGY_DISRUPTION
- PANDEMIC
- CORPORATE_EVENT
- TRANSPORT_ACCIDENT
- FINANCIAL_CRISIS
- OTHER

Rules:
- Never force supply-chain relevance for unrelated events.
- Sports, celebrity, entertainment gossip, elections without trade implications, and unrelated political news should usually be supply_chain_relevant=false and low scores.
- Use only these transport modes: Ocean, Air, Rail, Road, Pipeline.
- Give event-specific impacts and recommendations; if no impact exists, explain why.

Return ONLY valid JSON using this exact schema:
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
"summary": "",
"supply_chain_relevance_score": 0,
"severity_score": 0,
"supply_chain_impact_score": 0,
"geographic_importance_score": 0,
"confidence_score": 0,
"risk_score": 0,
"risk_level": "",
"supply_chain_relevant": true,
"impacts": {
"ocean_freight": "",
"air_freight": "",
"trucking": "",
"rail": "",
"route_risk": "",
"compliance": "",
"customs": "",
"inventory": "",
"warehousing": "",
"energy": "",
"sourcing": "",
"manufacturing": ""
},
"recommendations": []
}

Article:
{{ARTICLE_TEXT}}`;

const HIGH_PRIORITY_EVENT_TYPES = new Set([
  "PORT_DISRUPTION",
  "AIRPORT_DISRUPTION",
  "CANAL_DISRUPTION",
  "TRADE_POLICY_CHANGE",
  "SANCTIONS",
  "TARIFF_CHANGE",
  "LABOR_STRIKE",
  "NATURAL_DISASTER",
  "EXTREME_WEATHER",
  "MILITARY_CONFLICT",
  "GEOPOLITICAL_EVENT",
  "CYBER_ATTACK",
  "INFRASTRUCTURE_FAILURE",
  "ENERGY_DISRUPTION",
  "PANDEMIC",
  "TRANSPORT_ACCIDENT",
  "FINANCIAL_CRISIS"
]);

const VALID_EVENT_TYPES = new Set([
  ...HIGH_PRIORITY_EVENT_TYPES,
  "CORPORATE_EVENT",
  "REGULATORY_CHANGE",
  "OTHER"
]);

const VALID_TRANSPORT_MODES = new Set(["Ocean", "Air", "Rail", "Road", "Pipeline"]);

const BASE_SEVERITY = {
  PORT_DISRUPTION: 8,
  AIRPORT_DISRUPTION: 7,
  CANAL_DISRUPTION: 9,
  TRADE_POLICY_CHANGE: 6,
  SANCTIONS: 8,
  TARIFF_CHANGE: 6,
  REGULATORY_CHANGE: 4,
  LABOR_STRIKE: 6,
  NATURAL_DISASTER: 8,
  EXTREME_WEATHER: 7,
  MILITARY_CONFLICT: 9,
  GEOPOLITICAL_EVENT: 6,
  CYBER_ATTACK: 7,
  INFRASTRUCTURE_FAILURE: 7,
  ENERGY_DISRUPTION: 8,
  PANDEMIC: 8,
  TRANSPORT_ACCIDENT: 6,
  FINANCIAL_CRISIS: 7,
  CORPORATE_EVENT: 2,
  OTHER: 2
};

const BASE_IMPACT = {
  PORT_DISRUPTION: 8,
  AIRPORT_DISRUPTION: 7,
  CANAL_DISRUPTION: 9,
  TRADE_POLICY_CHANGE: 6,
  SANCTIONS: 8,
  TARIFF_CHANGE: 6,
  REGULATORY_CHANGE: 4,
  LABOR_STRIKE: 7,
  NATURAL_DISASTER: 8,
  EXTREME_WEATHER: 7,
  MILITARY_CONFLICT: 9,
  GEOPOLITICAL_EVENT: 6,
  CYBER_ATTACK: 7,
  INFRASTRUCTURE_FAILURE: 7,
  ENERGY_DISRUPTION: 8,
  PANDEMIC: 8,
  TRANSPORT_ACCIDENT: 6,
  FINANCIAL_CRISIS: 6,
  CORPORATE_EVENT: 2,
  OTHER: 2
};

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-8b-instant",
  temperature: 0,
  maxRetries: 2
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function extractJson(text) {
  const raw = String(text ?? "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  return JSON.parse(candidate);
}

function normalizeEvent(event, fallbackHeadline) {
  const eventType = String(event?.event_type ?? "OTHER").toUpperCase();
  const transportModes = toArray(event?.transport_modes).filter((mode) =>
    VALID_TRANSPORT_MODES.has(String(mode))
  );

  return {
    event_type: VALID_EVENT_TYPES.has(eventType) ? eventType : "OTHER",
    headline: String(event?.headline ?? fallbackHeadline ?? "Untitled"),
    countries: toArray(event?.countries),
    locations: toArray(event?.locations),
    ports: toArray(event?.ports),
    airports: toArray(event?.airports),
    canals: toArray(event?.canals),
    companies: toArray(event?.companies),
    commodities: toArray(event?.commodities),
    transport_modes: transportModes,
    summary: String(event?.summary ?? ""),
    supply_chain_relevance_score: Number(event?.supply_chain_relevance_score ?? 0),
    severity_score: Number(event?.severity_score ?? 0),
    supply_chain_impact_score: Number(event?.supply_chain_impact_score ?? 0),
    geographic_importance_score: Number(event?.geographic_importance_score ?? 0),
    confidence_score: Number(event?.confidence_score ?? 0),
    risk_score: Number(event?.risk_score ?? 0),
    risk_level: String(event?.risk_level ?? "INFORMATIONAL").toUpperCase(),
    supply_chain_relevant: Boolean(event?.supply_chain_relevant),
    impacts: {
      ocean_freight: String(event?.impacts?.ocean_freight ?? ""),
      air_freight: String(event?.impacts?.air_freight ?? ""),
      trucking: String(event?.impacts?.trucking ?? ""),
      rail: String(event?.impacts?.rail ?? ""),
      route_risk: String(event?.impacts?.route_risk ?? ""),
      compliance: String(event?.impacts?.compliance ?? ""),
      customs: String(event?.impacts?.customs ?? ""),
      inventory: String(event?.impacts?.inventory ?? ""),
      warehousing: String(event?.impacts?.warehousing ?? ""),
      energy: String(event?.impacts?.energy ?? ""),
      sourcing: String(event?.impacts?.sourcing ?? ""),
      manufacturing: String(event?.impacts?.manufacturing ?? "")
    },
    recommendations: toArray(event?.recommendations)
  };
}

function toArticleText(article) {
  const title = article.webTitle ?? article.fields?.headline ?? "Untitled";
  const section = article.sectionName ?? "Unknown";
  const publishedAt = article.webPublicationDate ?? "Unknown";
  const trailText = article.fields?.trailText ?? "";
  const bodyText = (article.fields?.bodyText ?? "").slice(0, 1300);

  return [
    `Headline: ${title}`,
    `Section: ${section}`,
    `Published: ${publishedAt}`,
    `URL: ${article.webUrl ?? "Unknown"}`,
    `Trail: ${trailText}`,
    `Body: ${bodyText}`
  ].join("\n");
}

async function extractEvent(article) {
  const prompt = EXTRACTION_PROMPT.replace("{{ARTICLE_TEXT}}", toArticleText(article));
  const response = await llm.invoke(prompt);
  const parsed = extractJson(response.content);
  return normalizeEvent(parsed, article.webTitle ?? article.fields?.headline ?? "Untitled");
}

function makeImpacts(event) {
  const noImpactReason = `No direct impact evidenced because ${event.event_type} in this article does not indicate active disruption to freight, supply, or production networks.`;
  const noImpact = {
    ocean_freight: noImpactReason,
    air_freight: noImpactReason,
    trucking: noImpactReason,
    rail: noImpactReason,
    route_risk: noImpactReason,
    compliance: noImpactReason,
    customs: noImpactReason,
    inventory: noImpactReason,
    warehousing: noImpactReason,
    energy: noImpactReason,
    sourcing: noImpactReason,
    manufacturing: noImpactReason
  };

  const impactsByType = {
    PORT_DISRUPTION: {
      ocean_freight: "Port throughput delays and higher berth waiting times are likely.",
      air_freight: "Limited direct impact unless belly-cargo substitution is triggered.",
      trucking: "Drayage and hinterland trucking schedules can slip due to terminal congestion.",
      rail: "Intermodal rail departures from port terminals may face cut-off delays.",
      route_risk: "Rerouting risk increases for nearby maritime corridors.",
      compliance: "Documentation cut-off changes can increase booking and compliance errors.",
      customs: "Customs clearance may slow due to operational disruption at gateways.",
      inventory: "Safety stock drawdown risk increases for import-dependent SKUs.",
      warehousing: "DC receiving windows may bunch due to uneven container arrivals.",
      energy: "No major direct energy impact unless fuel cargoes are delayed.",
      sourcing: "Supplier OTIF performance may decline for seaborne inputs.",
      manufacturing: "Production schedules may slip where imported components are JIT."
    },
    CANAL_DISRUPTION: {
      ocean_freight: "Transit constraints can materially increase voyage time and ocean rates.",
      air_freight: "Mode shift demand can tighten air capacity on urgent lanes.",
      trucking: "Downstream inland planning is disrupted by volatile vessel ETAs.",
      rail: "Rail planning variability rises due to delayed port handoffs.",
      route_risk: "Longer alternative routes increase exposure to congestion and incidents.",
      compliance: "Schedule changes raise risk of documentation and contractual non-compliance.",
      customs: "Customs processing bunching can occur when delayed vessels arrive in waves.",
      inventory: "Longer lead times elevate stockout risk for lean inventories.",
      warehousing: "Inbound surges after delays can create temporary warehouse congestion.",
      energy: "Longer routes raise bunker consumption and fuel-related cost pressure.",
      sourcing: "Single-corridor sourcing strategies become more vulnerable.",
      manufacturing: "Input availability volatility can interrupt production sequencing."
    },
    MILITARY_CONFLICT: {
      ocean_freight: "Conflict-zone routing and security constraints can delay vessel schedules.",
      air_freight: "Airspace restrictions can lengthen routings and reduce effective capacity.",
      trucking: "Cross-border trucking flows can slow at security checkpoints.",
      rail: "Rail corridors near conflict areas may face stoppages or reroutes.",
      route_risk: "War-risk exposure and insurance premiums are likely to rise.",
      compliance: "Sanctions and counterparty screening complexity increases materially.",
      customs: "Customs checks can intensify, raising clearance times.",
      inventory: "Higher uncertainty supports larger safety stock requirements.",
      warehousing: "Regional warehousing nodes may need relocation or contingency activation.",
      energy: "Energy supply disruptions can increase fuel and power price volatility.",
      sourcing: "Supplier continuity risk rises for conflict-adjacent regions.",
      manufacturing: "Factory uptime may decline if inputs or labor mobility are constrained."
    },
    SANCTIONS: {
      ocean_freight: "Carrier network adjustments likely on restricted lanes.",
      air_freight: "Restricted counterparties can force air cargo booking reconfiguration.",
      trucking: "Land-border freight may face additional screening and delays.",
      rail: "Rail corridors tied to sanctioned entities can see service limitations.",
      route_risk: "Secondary sanctions exposure can increase route risk.",
      compliance: "Trade compliance workload and screening requirements rise.",
      customs: "Customs declarations and licenses become more complex and slower.",
      inventory: "Sourcing shifts can create temporary replenishment gaps.",
      warehousing: "Buffer stock strategy may require additional storage capacity.",
      energy: "Energy flows may tighten if sanctioned entities include exporters.",
      sourcing: "Rapid supplier diversification pressure increases qualification workload.",
      manufacturing: "Plants dependent on restricted inputs may face output constraints."
    },
    ENERGY_DISRUPTION: {
      ocean_freight: "Bunker and marine fuel costs may push freight rates up.",
      air_freight: "Jet fuel volatility can increase air freight surcharges.",
      trucking: "Diesel price increases raise line-haul and last-mile costs.",
      rail: "Rail operating costs can rise with electricity or fuel shocks.",
      route_risk: "Energy supply uncertainty may alter route planning.",
      compliance: "Fuel surcharge and contract compliance management becomes critical.",
      customs: "No direct customs mechanism unless policy restrictions accompany disruption.",
      inventory: "Energy-intensive product buffers may be increased to hedge volatility.",
      warehousing: "Warehouse operating costs may rise due to power and cooling demand.",
      energy: "Direct impact on fuel and power input costs.",
      sourcing: "Procurement may shift toward lower-energy or local suppliers.",
      manufacturing: "Energy-intensive manufacturing margins and uptime may be pressured."
    },
    TARIFF_CHANGE: {
      ocean_freight: "No direct capacity shock, but trade lane mix may shift over time.",
      air_freight: "Urgent pre-tariff shipments can temporarily lift air demand.",
      trucking: "Border-region trucking flows may rebalance as sourcing shifts.",
      rail: "Intermodal volume may shift by corridor based on new duty exposure.",
      route_risk: "Route risk rises where sudden policy changes alter established lanes.",
      compliance: "Tariff classification and origin compliance burden increases.",
      customs: "Customs declarations become more complex due to duty recalculation.",
      inventory: "Front-loading and hedge-buying may increase short-term inventory.",
      warehousing: "Temporary storage demand can rise during pre-buy windows.",
      energy: "Energy impact is indirect via higher landed and transport costs.",
      sourcing: "Supplier diversification pressure increases to reduce tariff exposure.",
      manufacturing: "BOM cost changes may trigger production network re-optimization."
    }
  };

  return impactsByType[event.event_type] ?? noImpact;
}

function makeRecommendations(event, riskLevel) {
  if (riskLevel === "INFORMATIONAL") {
    return [];
  }

  if (event.event_type === "SANCTIONS") {
    return [
      "Run enhanced denied-party and ownership screening before new bookings.",
      "Pre-clear substitute suppliers in compliant jurisdictions.",
      "Review Incoterms and contracts for sanctions-related force majeure and delay clauses."
    ];
  }

  if (event.event_type === "PORT_DISRUPTION") {
    return [
      "Rebook to alternate ports and pre-arrange drayage capacity.",
      "Prioritize high-margin and service-critical cargo for expedited handling.",
      "Coordinate revised ETA windows with distribution centers and key customers."
    ];
  }

  if (event.event_type === "CANAL_DISRUPTION") {
    return [
      "Model transit-time impact under alternate canal bypass routes.",
      "Rebalance inventory targets for SKUs with long ocean lead times.",
      "Lock forward ocean capacity and validate bunker surcharge assumptions."
    ];
  }

  if (event.event_type === "ENERGY_DISRUPTION") {
    return [
      "Stress-test transport budgets against fuel surcharge scenarios.",
      "Reprioritize lanes and modes for margin-critical products.",
      "Assess fixed-price energy contracts for production and warehousing sites."
    ];
  }

  if (event.event_type === "MILITARY_CONFLICT") {
    return [
      "Activate corridor-specific rerouting playbooks and insurer coordination.",
      "Increase safety stock for conflict-exposed components and materials.",
      "Run daily compliance checks for sanctions and restricted parties."
    ];
  }

  if (event.event_type === "TARIFF_CHANGE" || event.event_type === "TRADE_POLICY_CHANGE") {
    return [
      "Quantify SKU-level landed-cost exposure under revised tariff schedules.",
      "Re-evaluate sourcing mix by country of origin and duty treatment.",
      "Update customs classification and origin documentation controls."
    ];
  }

  return [
    "Increase monitoring frequency for impacted suppliers, lanes, and nodes.",
    "Validate continuity plans for affected transport and sourcing dependencies.",
    "Review inventory policy for critical SKUs until event uncertainty declines."
  ];
}

function assessEventRisk(event) {
  const baseSeverity = BASE_SEVERITY[event.event_type] ?? 2;
  const baseImpact = BASE_IMPACT[event.event_type] ?? 2;

  let severity = baseSeverity;
  let impact = baseImpact;
  let relevance = HIGH_PRIORITY_EVENT_TYPES.has(event.event_type) ? 7 : 2;
  let geo = event.countries.length > 1 ? 6 : 3;

  if (event.ports.length > 0 || event.canals.length > 0 || event.airports.length > 0) {
    relevance += 1;
    impact += 1;
    geo += 1;
  }

  if (event.transport_modes.length >= 2) {
    impact += 1;
    relevance += 1;
  }

  if (event.commodities.some((c) => /oil|gas|diesel|lng|crude/i.test(String(c)))) {
    severity += 1;
    impact += 1;
    relevance += 1;
    geo += 1;
  }

  if (event.countries.length >= 3) {
    geo += 2;
  }

  if (event.locations.length >= 2 || event.companies.length >= 3) {
    geo += 1;
  }

  const evidenceCount = [event.countries, event.locations, event.ports, event.airports, event.canals, event.commodities, event.transport_modes]
    .map((arr) => arr.length)
    .filter((n) => n > 0).length;
  let confidence = 4 + evidenceCount;

  severity = clamp(severity, 0, 10);
  impact = clamp(impact, 0, 10);
  relevance = clamp(relevance, 0, 10);
  geo = clamp(geo, 0, 10);
  confidence = clamp(confidence, 0, 10);

  if (!HIGH_PRIORITY_EVENT_TYPES.has(event.event_type)) {
    relevance = Math.min(relevance, 3);
  }

  const riskScore = Math.round((
    0.30 * severity +
    0.30 * impact +
    0.20 * relevance +
    0.10 * geo +
    0.10 * confidence
  ) * 10);

  let riskLevel = "INFORMATIONAL";
  if (riskScore >= 85) {
    riskLevel = "CRITICAL";
  } else if (riskScore >= 70) {
    riskLevel = "HIGH";
  } else if (riskScore >= 50) {
    riskLevel = "MEDIUM";
  } else if (riskScore >= 25) {
    riskLevel = "LOW";
  }

  if (relevance <= 2) {
    riskLevel = "INFORMATIONAL";
  }

  return {
    ...event,
    supply_chain_relevance_score: relevance,
    severity_score: severity,
    supply_chain_impact_score: impact,
    geographic_importance_score: geo,
    confidence_score: confidence,
    risk_score: riskScore,
    risk_level: riskLevel,
    supply_chain_relevant: relevance >= 3,
    impacts: makeImpacts(event),
    recommendations: makeRecommendations(event, riskLevel)
  };
}

function shouldSkipArticle(article) {
  const section = String(article.sectionName ?? "").toLowerCase();
  const title = String(article.webTitle ?? "").toLowerCase();

  const noisySections = new Set(["sport", "football", "culture", "fashion", "lifeandstyle", "music", "film", "tv-and-radio"]);
  if (noisySections.has(section)) {
    return true;
  }

  const noisyPatterns = ["world cup", "transfer", "celebrity", "red carpet", "film review", "tv review"];
  return noisyPatterns.some((p) => title.includes(p));
}

async function fetchArticles() {
  if (!process.env.GUARDIAN_API_KEY) {
    throw new Error("GUARDIAN_API_KEY is missing. Add it to ai/.env.");
  }
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing. Add it to ai/.env.");
  }

  const response = await axios.get("https://content.guardianapis.com/search", {
    params: {
      q: SEARCH_QUERY,
      "show-fields": "headline,trailText,bodyText",
      "page-size": 20,
      "order-by": "newest",
      "api-key": process.env.GUARDIAN_API_KEY
    }
  });

  const results = response.data.response.results ?? [];
  return results.filter((article) => !shouldSkipArticle(article));
}

function normalizeFinalOutput(item) {
  const numeric = (n, min, max) => clamp(Number(n || 0), min, max);
  const level = String(item.risk_level || "INFORMATIONAL").toUpperCase();

  return {
    event_type: VALID_EVENT_TYPES.has(item.event_type) ? item.event_type : "OTHER",
    headline: item.headline || "Untitled",
    countries: toArray(item.countries),
    locations: toArray(item.locations),
    ports: toArray(item.ports),
    airports: toArray(item.airports),
    canals: toArray(item.canals),
    companies: toArray(item.companies),
    commodities: toArray(item.commodities),
    transport_modes: toArray(item.transport_modes).filter((m) => VALID_TRANSPORT_MODES.has(m)),
    summary: String(item.summary || ""),
    supply_chain_relevance_score: numeric(item.supply_chain_relevance_score, 0, 10),
    severity_score: numeric(item.severity_score, 0, 10),
    supply_chain_impact_score: numeric(item.supply_chain_impact_score, 0, 10),
    geographic_importance_score: numeric(item.geographic_importance_score, 0, 10),
    confidence_score: numeric(item.confidence_score, 0, 10),
    risk_score: numeric(item.risk_score, 0, 100),
    risk_level: ["INFORMATIONAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(level) ? level : "INFORMATIONAL",
    supply_chain_relevant: Boolean(item.supply_chain_relevant),
    impacts: {
      ocean_freight: String(item.impacts?.ocean_freight || "No direct ocean freight impact evidenced."),
      air_freight: String(item.impacts?.air_freight || "No direct air freight impact evidenced."),
      trucking: String(item.impacts?.trucking || "No direct trucking impact evidenced."),
      rail: String(item.impacts?.rail || "No direct rail impact evidenced."),
      route_risk: String(item.impacts?.route_risk || "No route risk change evidenced."),
      compliance: String(item.impacts?.compliance || "No compliance burden increase evidenced."),
      customs: String(item.impacts?.customs || "No customs process impact evidenced."),
      inventory: String(item.impacts?.inventory || "No direct inventory impact evidenced."),
      warehousing: String(item.impacts?.warehousing || "No direct warehousing impact evidenced."),
      energy: String(item.impacts?.energy || "No direct energy supply impact evidenced."),
      sourcing: String(item.impacts?.sourcing || "No direct sourcing disruption evidenced."),
      manufacturing: String(item.impacts?.manufacturing || "No direct manufacturing disruption evidenced.")
    },
    recommendations: toArray(item.recommendations)
  };
}

async function runRiskAssessment() {
  const articles = await fetchArticles();
  const outputs = [];

  for (const article of articles.slice(0, 5)) {
    try {
      const event = await extractEvent(article);
      const assessed = assessEventRisk(event);
      outputs.push(normalizeFinalOutput(assessed));
    } catch {
      // Keep output stable even if one article fails parsing.
    }
  }

  console.log(JSON.stringify(outputs, null, 2));
}

runRiskAssessment().catch((error) => {
  const message = axios.isAxiosError(error)
    ? (error.response?.data?.message || error.message)
    : error.message;
  console.log(JSON.stringify({ error: message }, null, 2));
});
