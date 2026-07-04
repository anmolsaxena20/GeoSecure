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

const encodeJson = (value) => ({ data_json: JSON.stringify(value ?? null) });

const handleUnary = async (resolver, callback) => {
  try {
    const result = await resolver();
    callback(null, encodeJson(result));
  } catch (error) {
    callback(error);
  }
};

server.addService(proto.ai.AIService.service, {
  GenerateReport: (_call, callback) =>
    handleUnary(generateSupplyChainReport, callback),
  FetchMarketData: (_call, callback) => handleUnary(fetchMarketData, callback),
  FetchNews: (_call, callback) => handleUnary(fetchAllNews, callback),
  RunDisruptionAgent: (_call, callback) =>
    handleUnary(runDisruptionAgent, callback),
  GetCorridorRiskScores: (_call, callback) =>
    handleUnary(getCorridorRiskScores, callback),
  GetCommodityRiskScores: (_call, callback) =>
    handleUnary(getCommodityRiskScores, callback),
  RunSupplyChainEconomiesAgent: (_call, callback) =>
    handleUnary(runSupplyChainEconomiesAgent, callback),
  GetHighRiskEvents: (_call, callback) =>
    handleUnary(getHighRiskEvents, callback),
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
