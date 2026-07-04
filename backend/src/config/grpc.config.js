import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDefinition = protoLoader.loadSync(
  path.resolve(__dirname, "../../../grpc-contracts/ai.proto"),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  },
);

const proto = grpc.loadPackageDefinition(packageDefinition);
const aiProto = proto.ai;

const aiClient = new aiProto.AIService(
  process.env.AI_SERVICE_HOST || "127.0.0.1:8000",
  process.env.AI_SERVICE_USE_SSL === "true"
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure(),
);

export default aiClient;
