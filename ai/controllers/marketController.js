import { fetchMarketSignals } from "../services/marketAggregator.js";

export async function fetchMarketData() {
    return await fetchMarketSignals();
}