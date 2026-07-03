import axios from "axios";

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";

const delay = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

async function call(params) {
  const response = await axios.get(BASE_URL, {
    params: {
      ...params,
      apikey: API_KEY
    },
    timeout: 15000
  });

  if (response.data.Note) {
    throw new Error("AlphaVantage rate limit exceeded");
  }

  return response.data;
}

export async function fetchCommodities() {
  const functions = [
    "BRENT",
    "WTI",
    "NATURAL_GAS",
    "COPPER",
    "WHEAT",
    "ALL_COMMODITIES"
  ];

  const result = {};

  for (const fn of functions) {
    result[fn] = await call({
      function: fn,
      interval: "monthly"
    });

    await delay(15000);
  }

  return result;
}

export async function fetchForex() {
  return call({
    function: "CURRENCY_EXCHANGE_RATE",
    from_currency: "USD",
    to_currency: "INR"
  });
}

const STOCKS = [
  "FDX",
  "UPS",
  "ZIM",
  "TSM",
  "NVDA",
  "CAT",
  "XLE",
  "SPY"
];

export async function fetchStocks() {
  const stocks = [];

  for (const symbol of STOCKS) {
    const data = await call({
      function: "GLOBAL_QUOTE",
      symbol
    });

    stocks.push({
      symbol,
      price: data["Global Quote"]?.["05. price"],
      change: data["Global Quote"]?.["10. change percent"]
    });

    await delay(15000);
  }

  return stocks;
}