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

const serviceApiKey = process.env.AI_SERVICE_API_KEY;

const missingApiKeyError = () => {
  const error = new Error("AI_SERVICE_API_KEY is not configured");
  error.code = grpc.status.FAILED_PRECONDITION;
  return error;
};

const aiClient = new aiProto.AIService(
  process.env.AI_SERVICE_HOST || "127.0.0.1:8000",
  process.env.AI_SERVICE_USE_SSL === "true"
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure(),
);

const invokeUnary = (methodName, request = {}) => {
  return new Promise((resolve, reject) => {
    if (!serviceApiKey) {
      reject(missingApiKeyError());
      return;
    }

    const metadata = new grpc.Metadata();
    metadata.set("x-api-key", serviceApiKey);

    aiClient[methodName](request, metadata, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
};

export const aiGrpcCall = invokeUnary;

export default aiClient;
