import { aiHttpCall } from "../config/ai.config.js";

const invokeAiRoute = async (methodName) => {
  const response = await aiHttpCall(methodName);
  return response ?? null;
};

const sendAiResult = async (res, methodName) => {
  const result = await invokeAiRoute(methodName);
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
