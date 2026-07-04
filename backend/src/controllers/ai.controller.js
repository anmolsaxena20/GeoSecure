import { aiGrpcCall } from "../config/grpc.config.js";

const invokeGrpc = (methodName) => {
  return new Promise((resolve, reject) => {
    aiGrpcCall(methodName)
      .then((response) => {
        const payload = response?.data_json ?? null;

        if (typeof payload !== "string") {
          resolve(payload);
          return;
        }

        try {
          resolve(JSON.parse(payload));
        } catch {
          resolve(payload);
        }
      })
      .catch(reject);
  });
};

const sendGrpcResult = async (res, methodName) => {
  const result = await invokeGrpc(methodName);
  return res.status(200).json(result);
};

export const generateReport = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "GenerateReport");
  } catch (error) {
    return next(error);
  }
};

export const fetchMarketData = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "FetchMarketData");
  } catch (error) {
    return next(error);
  }
};

export const fetchNews = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "FetchNews");
  } catch (error) {
    return next(error);
  }
};

export const runDisruptionAgent = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "RunDisruptionAgent");
  } catch (error) {
    return next(error);
  }
};

export const getCorridorRiskScores = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "GetCorridorRiskScores");
  } catch (error) {
    return next(error);
  }
};

export const getCommodityRiskScores = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "GetCommodityRiskScores");
  } catch (error) {
    return next(error);
  }
};

export const runSupplyChainEconomiesAgent = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "RunSupplyChainEconomiesAgent");
  } catch (error) {
    return next(error);
  }
};

export const getHighRiskEvents = async (_req, res, next) => {
  try {
    return await sendGrpcResult(res, "GetHighRiskEvents");
  } catch (error) {
    return next(error);
  }
};
