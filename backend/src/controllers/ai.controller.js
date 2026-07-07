import { aiHttpCall } from "../config/ai.config.js";
import { getRedisClient } from "../config/redis.config.js";

const DISRUPTION_CACHE_TTL_SECONDS = Number(
  process.env.DISRUPTION_CACHE_TTL_SECONDS || 300,
);

const disruptionCacheKeys = {
  RunDisruptionAgent: "cache:disruption:run",
  GetCorridorRiskScores: "cache:disruption:corridors",
  GetCommodityRiskScores: "cache:disruption:commodities",
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
