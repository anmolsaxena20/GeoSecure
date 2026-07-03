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
    const port = process.env.PORT || 8000;

    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          console.error(err);
          return;
        }

        server.start();

        console.log(`gRPC server listening on ${boundPort}`);
      },
    );
  });
};

await startGrpcServer();
