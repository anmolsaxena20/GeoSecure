import { ChatGroq } from "@langchain/groq";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ai/.env even when this script is run from ai/agents.
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

// -------------------- TOOL --------------------
const weatherTool = tool(
  async ({ city }) => {
    const weatherData = {
      London: "18°C and cloudy",
      Delhi: "38°C and sunny",
      Tokyo: "25°C and rainy",
    };

    return weatherData[city] || `Weather data for ${city} not found`;
  },
  {
    name: "weather",
    description: "Get weather information for a city",
    schema: z.object({
      city: z.string().describe("Name of the city"),
    }),
  }
);

const tools = [weatherTool];

// -------------------- LLM --------------------
const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
}).bindTools(tools);

// -------------------- TOOL NODE --------------------
const toolNode = new ToolNode(tools);

// -------------------- AGENT NODE --------------------
async function callModel(state) {
  const response = await llm.invoke(state.messages);

  return {
    messages: [response],
  };
}

// -------------------- ROUTING --------------------
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];

  if (lastMessage.tool_calls?.length > 0) {
    return "tools";
  }

  return END;
}

// -------------------- GRAPH --------------------
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)

  .addEdge(START, "agent")

  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    [END]: END,
  })

  .addEdge("tools", "agent");

const app = graph.compile();

// -------------------- EXECUTE --------------------
const result = await app.invoke({
  messages: [
    new HumanMessage("What is the weather in Delhi?")
  ],
});

console.log(
  result.messages[result.messages.length - 1].content
);