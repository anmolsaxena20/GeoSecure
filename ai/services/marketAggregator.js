import {
  fetchCommodities,
  fetchForex,
  fetchStocks
} from "./alphaVantageService.js";

import {
  fetchWorldBankIndicators
} from "./worldBankService.js";

export async function fetchMarketSignals() {
  const [
    commodities,
    forex,
    stocks,
    worldBank
  ] = await Promise.all([
    fetchCommodities(),
    fetchForex(),
    fetchStocks(),
    fetchWorldBankIndicators()
  ]);

  return {
    generated_at: new Date().toISOString(),
    commodities,
    forex,
    stocks,
    worldBank
  };
}