import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const packageDefinition = protoLoader.loadSync("../../grpc-contracts/ai.proto");

const proto = grpc.loadPackageDefinition(packageDefinition);
const aiProto = proto.ai;

const aiClient = new aiProto.AIService(
  process.env.AI_SERVICE_HOST,
  grpc.credentials.createSsl(),
);

export default aiClient;
