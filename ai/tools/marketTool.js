import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  fetchMarketSignals
} from "../services/marketAggregator.js";

export const fetchMarketIntelligence = tool(
  async () => {
    const data =
      await fetchMarketSignals();

    return JSON.stringify(data);
  },
  {
    name: "fetch_market_intelligence",
    description:
      "Fetch commodity, stock, forex and macroeconomic indicators relevant to supply chain risks.",
    schema: z.object({})
  }
);