import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_PATH = path.resolve(__dirname, "../grpc-contracts/ai.proto");
const GRPC_PORT = process.env.AI_GRPC_PORT || 8000;

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server();
const expectedApiKey = process.env.AI_SERVICE_API_KEY;

const encodeJson = (value) => ({ data_json: JSON.stringify(value ?? null) });

const unauthenticatedError = () => {
  const error = new Error("Unauthorized");
  error.code = grpc.status.UNAUTHENTICATED;
  return error;
};

const isAuthorized = (call) => {
  if (!expectedApiKey) {
    return false;
  }

  const apiKey = call.metadata.get("x-api-key")?.[0];
  return typeof apiKey === "string" && apiKey === expectedApiKey;
};

const handleUnary = async (call, resolver, callback) => {
  if (!isAuthorized(call)) {
    callback(unauthenticatedError());
    return;
  }

  try {
    const result = await resolver();
    callback(null, encodeJson(result));
  } catch (error) {
    callback(error);
  }
};

server.addService(proto.ai.AIService.service, {
  GenerateReport: (_call, callback) =>
    handleUnary(_call, generateSupplyChainReport, callback),
  FetchMarketData: (call, callback) =>
    handleUnary(call, fetchMarketData, callback),
  FetchNews: (call, callback) => handleUnary(call, fetchAllNews, callback),
  RunDisruptionAgent: (_call, callback) =>
    handleUnary(_call, runDisruptionAgent, callback),
  GetCorridorRiskScores: (_call, callback) =>
    handleUnary(_call, getCorridorRiskScores, callback),
  GetCommodityRiskScores: (_call, callback) =>
    handleUnary(_call, getCommodityRiskScores, callback),
  RunSupplyChainEconomiesAgent: (_call, callback) =>
    handleUnary(_call, runSupplyChainEconomiesAgent, callback),
  GetHighRiskEvents: (_call, callback) =>
    handleUnary(_call, getHighRiskEvents, callback),
});

const startGrpcServer = () => {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          reject(err);
          return;
        }

        server.start();

        console.log(`gRPC server listening on ${boundPort}`);
        resolve(boundPort);
      },
    );
  });
};

await startGrpcServer();
