import { ChatGroq } from "@langchain/groq"
import dotenv from 'dotenv';
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ai/.env even when the script is run from ai/configs.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0,
    maxTokens: undefined,
    maxRetries: 2,
    // other params...
})
const aiMsg = await llm.invoke([
    {
      role: "system",
      content: "You are a helpful assistant that translates English to French. Translate the user sentence.",
    },
    { role: "user", content: "I love programming." },
])
console.log(aiMsg.content)