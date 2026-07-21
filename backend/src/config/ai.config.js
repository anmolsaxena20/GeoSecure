const routeMap = {
  GenerateReport: { method: "GET", path: "/api/ai/report" },
  FetchMarketData: { method: "GET", path: "/api/ai/market" },
  FetchNews: { method: "GET", path: "/api/ai/news" },
  RunDisruptionAgent: { method: "POST", path: "/api/ai/disruption/run" },
  GetCorridorRiskScores: {
    method: "GET",
    path: "/api/ai/disruption/corridors",
  },
  GetCommodityRiskScores: {
    method: "GET",
    path: "/api/ai/disruption/commodities",
  },
  RunSupplyChainEconomiesAgent: {
    method: "POST",
    path: "/api/ai/economies/run",
  },
  GetHighRiskEvents: {
    method: "GET",
    path: "/api/ai/economies/high-risk-events",
  },
  RunProcurementOrchestrator: {
    method: "POST",
    path: "/api/ai/procurement/run",
  },
  GetProcurementRecommendations: {
    method: "GET",
    path: "/api/ai/procurement/recommendations",
  },
  RunStrategicReserveAgent: {
    method: "POST",
    path: "/api/ai/reserve/run",
  },
  RunSupplyAgent: {
    method: "POST",
    path: "/api/ai/supply-agent/run",
  },
  CopilotChat: {
    method: "POST",
    path: "/api/ai/copilot/chat",
  },
  CreateCopilotSession: {
    method: "POST",
    path: "/api/ai/copilot/sessions",
  },
  GetCopilotUserSessions: {
    method: "GET",
    path: "/api/ai/copilot/sessions/:userId",
  },
  GetCopilotSessionMessages: {
    method: "GET",
    path: "/api/ai/copilot/sessions/:sessionId/messages",
  },
};

const normalizeBaseUrl = (value) => {
  const trimmed = `${value || ""}`.trim();

  if (!trimmed) {
    return "http://127.0.0.1:8000";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/$/, "");
  }

  return `http://${trimmed.replace(/\/$/, "")}`;
};

const serviceUrl = normalizeBaseUrl(
  process.env.AI_SERVICE_URL || process.env.AI_SERVICE_HOST,
);
const serviceApiKey = process.env.AI_SERVICE_API_KEY;

const missingApiKeyError = () => {
  const error = new Error("AI_SERVICE_API_KEY is not configured");
  error.status = 500;
  return error;
};

const parseResponseBody = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const invokeUnary = async (methodName, request = {}, pathParams = {}) => {
  const route = routeMap[methodName];

  if (!route) {
    throw new Error(`Unsupported AI method: ${methodName}`);
  }

  if (!serviceApiKey) {
    throw missingApiKeyError();
  }

  let targetPath = route.path;
  if (pathParams && typeof pathParams === "object") {
    Object.keys(pathParams).forEach((key) => {
      targetPath = targetPath.replace(`:${key}`, encodeURIComponent(pathParams[key]));
    });
  }

  const response = await fetch(`${serviceUrl}${targetPath}`, {
    method: route.method,
    headers: {
      "content-type": "application/json",
      "x-api-key": serviceApiKey,
    },
    body:
      route.method === "GET" || Object.keys(request).length === 0
        ? undefined
        : JSON.stringify(request),
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(
      payload?.message || `AI request failed with ${response.status}`,
    );
    error.status = response.status;
    throw error;
  }

  return payload;
};

export const aiHttpCall = invokeUnary;
