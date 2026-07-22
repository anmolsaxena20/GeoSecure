import axios from "axios";

// Helper to generate dynamic random walk values based on current hour/minute to simulate live ticks
const getDynamicValue = (baseValue, volatility = 0.02) => {
  const time = new Date().getTime();
  const seed = (time % 1000000) / 1000000; // 0 to 1
  const change = (seed - 0.5) * 2 * volatility;
  return Number((baseValue * (1 + change)).toFixed(2));
};

export async function fetchCommodities() {
  // Simulate live commodity prices
  return {
    BRENT: { data: [{ value: getDynamicValue(75.5, 0.05), date: new Date().toISOString() }] },
    WTI: { data: [{ value: getDynamicValue(71.2, 0.05), date: new Date().toISOString() }] },
    NATURAL_GAS: { data: [{ value: getDynamicValue(2.8, 0.08), date: new Date().toISOString() }] },
    COPPER: { data: [{ value: getDynamicValue(3.9, 0.03), date: new Date().toISOString() }] },
    WHEAT: { data: [{ value: getDynamicValue(580.5, 0.04), date: new Date().toISOString() }] },
    ALL_COMMODITIES: { data: [{ value: getDynamicValue(120.0, 0.02), date: new Date().toISOString() }] }
  };
}

export async function fetchForex() {
  // Simulate live USD/INR exchange rate
  return {
    "Realtime Currency Exchange Rate": {
      "5. Exchange Rate": getDynamicValue(83.5, 0.005).toString()
    }
  };
}

const STOCKS_BASE = {
  "FDX": 250.45,
  "UPS": 140.20,
  "ZIM": 15.30,
  "TSM": 145.60,
  "NVDA": 850.25,
  "CAT": 320.10,
  "XLE": 85.40,
  "SPY": 510.30
};

export async function fetchStocks() {
  const stocks = [];
  
  for (const [symbol, basePrice] of Object.entries(STOCKS_BASE)) {
    const livePrice = getDynamicValue(basePrice, 0.015);
    const change = (((livePrice - basePrice) / basePrice) * 100).toFixed(2);
    
    stocks.push({
      symbol,
      price: livePrice.toString(),
      change: `${change}%`
    });
  }

  return stocks;
}