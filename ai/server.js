import "dotenv/config";
import express from "express";

import { generateSupplyChainReport } from "./controllers/reportController.js";
import { fetchAllNews } from "./controllers/newsController.js";
import { fetchMarketData } from "./controllers/marketController.js";
import {
  runDisruptionAgent,
  getCorridorRiskScores,
  getCommodityRiskScores,
} from "./controllers/disruptionController.js";
import {
  runSupplyChainEconomiesAgent,
  getHighRiskEvents,
} from "./controllers/supplyChainEconomiesController.js";
import {
  getProcurementRecommendations,
  runProcurementOrchestrator,
} from "./controllers/procurementController.js";
import { startNewsCron } from "./polling/pollingAgent.js";

const app = express();
const port = process.env.PORT || 8000;
const expectedApiKey = process.env.AI_SERVICE_API_KEY;

const sendJson = async (res, resolver) => {
  const result = await resolver();
  return res.status(200).json(result);
};

const requireApiKey = (req, res, next) => {
  if (!expectedApiKey) {
    return res
      .status(500)
      .json({ message: "AI_SERVICE_API_KEY is not configured" });
  }

  const apiKey = req.get("x-api-key");
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
};

app.use(express.json());

app.get("/", (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.get("/api/ai/report", requireApiKey, async (_req, res, next) => {
  try {
    return await sendJson(res, generateSupplyChainReport);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/ai/market", requireApiKey, async (_req, res, next) => {
  try {
    return await sendJson(res, fetchMarketData);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/ai/news", requireApiKey, async (_req, res, next) => {
  try {
    return await sendJson(res, fetchAllNews);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/ai/disruption/run", requireApiKey, async (_req, res, next) => {
  try {
    return await sendJson(res, runDisruptionAgent);
  } catch (error) {
    return next(error);
  }
});

app.get(
  "/api/ai/disruption/corridors",
  requireApiKey,
  async (_req, res, next) => {
    try {
      return await sendJson(res, getCorridorRiskScores);
    } catch (error) {
      return next(error);
    }
  },
);

app.get(
  "/api/ai/disruption/commodities",
  requireApiKey,
  async (_req, res, next) => {
    try {
      return await sendJson(res, getCommodityRiskScores);
    } catch (error) {
      return next(error);
    }
  },
);

app.post("/api/ai/economies/run", requireApiKey, async (_req, res, next) => {
  try {
    return await sendJson(res, runSupplyChainEconomiesAgent);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/ai/procurement/run", requireApiKey, async (_req, res, next) => {
  try {
    return await sendJson(res, runProcurementOrchestrator);
  } catch (error) {
    return next(error);
  }
});

app.get(
  "/api/ai/procurement/recommendations",
  requireApiKey,
  async (_req, res, next) => {
    try {
      return await sendJson(res, getProcurementRecommendations);
    } catch (error) {
      return next(error);
    }
  },
);

app.get(
  "/api/ai/economies/high-risk-events",
  requireApiKey,
  async (_req, res, next) => {
    try {
      return await sendJson(res, getHighRiskEvents);
    } catch (error) {
      return next(error);
    }
  },
);

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  return res.status(status).json({ message });
});

startNewsCron();

app.listen(port, () => {
  console.log(`AI HTTP server listening on port ${port}`);
});
