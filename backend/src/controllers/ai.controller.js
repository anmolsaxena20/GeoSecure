import { aiHttpCall } from "../config/ai.config.js";
import { getRedisClient } from "../config/redis.config.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DISRUPTION_CACHE_TTL_SECONDS = Number(
  process.env.DISRUPTION_CACHE_TTL_SECONDS || 300,
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const disruptionScenarioDataPath = path.resolve(
  __dirname,
  "../../../ai/agents/dashboard_data.js",
);
const reserveOptimisationDataPath = path.resolve(
  __dirname,
  "../../../ai/agents/dashboard_data.js",
);

const disruptionCacheKeys = {
  RunDisruptionAgent: "cache:disruption:run",
  GetCorridorRiskScores: "cache:disruption:corridors",
  GetCommodityRiskScores: "cache:disruption:commodities",
  GetProcurementRecommendations: "cache:procurement:recommendations",
};

const parseCachedValue = (value) => {
  if (value == null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const invokeAiRoute = async (methodName) => {
  const response = await aiHttpCall(methodName);
  return response ?? null;
};

const getCachedAiResult = async (methodName) => {
  const cacheKey = disruptionCacheKeys[methodName];

  if (!cacheKey) {
    return invokeAiRoute(methodName);
  }

  const redisClient = await getRedisClient();

  if (redisClient) {
    try {
      const cachedValue = await redisClient.get(cacheKey);

      if (cachedValue !== null) {
        return parseCachedValue(cachedValue);
      }
    } catch (error) {
      console.error(`Redis cache read failed for ${cacheKey}:`, error);
    }
  }

  const result = await invokeAiRoute(methodName);

  if (redisClient) {
    try {
      await redisClient.setEx(
        cacheKey,
        DISRUPTION_CACHE_TTL_SECONDS,
        JSON.stringify(result),
      );
    } catch (error) {
      console.error(`Redis cache write failed for ${cacheKey}:`, error);
    }
  }

  return result;
};

const sendAiResult = async (res, methodName) => {
  const result = await getCachedAiResult(methodName);
  return res.status(200).json(result);
};

export const generateReport = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "GenerateReport");
  } catch (error) {
    return next(error);
  }
};

export const fetchMarketData = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "FetchMarketData");
  } catch (error) {
    return next(error);
  }
};

export const fetchNews = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "FetchNews");
  } catch (error) {
    return next(error);
  }
};

export const runDisruptionAgent = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "RunDisruptionAgent");
  } catch (error) {
    return next(error);
  }
};

export const getCorridorRiskScores = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "GetCorridorRiskScores");
  } catch (error) {
    return next(error);
  }
};

export const getCommodityRiskScores = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "GetCommodityRiskScores");
  } catch (error) {
    return next(error);
  }
};

export const runSupplyChainEconomiesAgent = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "RunSupplyChainEconomiesAgent");
  } catch (error) {
    return next(error);
  }
};

export const getHighRiskEvents = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "GetHighRiskEvents");
  } catch (error) {
    return next(error);
  }
};

export const runProcurementOrchestrator = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "RunProcurementOrchestrator");
  } catch (error) {
    return next(error);
  }
};

export const getProcurementRecommendations = async (_req, res, next) => {
  try {
    return await sendAiResult(res, "GetProcurementRecommendations");
  } catch (error) {
    return next(error);
  }
};

export const getDisruptionScenarios = async (_req, res, next) => {
  try {
    const fileContents = await fs.readFile(disruptionScenarioDataPath, "utf8");
    const match = fileContents.match(/const\s+dashboardData\s*=\s*([\s\S]*?);\s*$/);

    if (!match) {
      throw new Error("Unable to parse disruption scenario data");
    }

    const structured = new Function(`return (${match[1]});`)();
    return res.status(200).json(structured);
  } catch (error) {
    return next(error);
  }
};

export const getReserveOptimisationData = async (_req, res, next) => {
  try {
    const fileContents = await fs.readFile(reserveOptimisationDataPath, "utf8");
    const match = fileContents.match(/const\s+dashboardData\s*=\s*([\s\S]*?);\s*$/);

    if (!match) {
      throw new Error("Unable to parse reserve optimisation data");
    }

    const structured = new Function(`return (${match[1]});`)();
    return res.status(200).json(structured);
  } catch (error) {
    return next(error);
  }
};
