import { getMarketSnapshot } from "../services/marketService.js";

export async function fetchMarketData() {
    return await getMarketSnapshot();
}