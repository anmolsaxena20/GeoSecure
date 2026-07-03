import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ChatGroq } from "@langchain/groq";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

export const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    temperature: 0
});