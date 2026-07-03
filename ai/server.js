import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

import { generateSupplyChainReport } from "./controllers/reportController.js";
import { fetchAllNews } from "./controllers/newsController.js";
import { fetchMarketData } from "./controllers/marketController.js";

const PROTO_PATH = "../grpc-contracts/ai.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server();

server.addService(proto.ai.AIService.service, {
  GenerateReport: generateSupplyChainReport,
  FetchMarketData: fetchMarketData,
  FetchNews: fetchAllNews,
});

const startGrpcServer = () => {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      process.env.GRPC_PORT || "localhost:8000",
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          reject(err);
          return;
        }

        server.start();

        console.log(`gRPC AI Server running on port ${port}`);

        resolve(server);
      },
    );
  });
};

await startGrpcServer();
