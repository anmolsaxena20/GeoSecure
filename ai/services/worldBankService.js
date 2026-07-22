import axios from "axios";

// Fallback dynamic mock for World Bank API
const getDynamicValue = (baseValue, volatility = 0.05) => {
  const time = new Date().getTime();
  const seed = (time % 1000000) / 1000000;
  const change = (seed - 0.5) * 2 * volatility;
  return Number((baseValue * (1 + change)).toFixed(2));
};

export async function fetchWorldBankIndicators() {
  // Simulating World Bank Indicators (trade to GDP, inflation, etc.)
  return {
    trade_to_gdp: getDynamicValue(60.5, 0.02),
    inflation: getDynamicValue(3.4, 0.1),
    gdp_growth: getDynamicValue(2.8, 0.05),
    container_traffic: getDynamicValue(850000000, 0.01)
  };
}