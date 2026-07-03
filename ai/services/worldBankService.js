import axios from "axios";

const INDICATORS = {
  trade_to_gdp: "NE.TRD.GNFS.ZS",
  inflation: "FP.CPI.TOTL.ZG",
  gdp_growth: "NY.GDP.MKTP.KD.ZG",
  container_traffic: "IS.SHP.GOOD.TU"
};

export async function fetchWorldBankIndicators() {
  const result = {};

  for (const [name, code] of Object.entries(
    INDICATORS
  )) {
    const response = await axios.get(
      `https://api.worldbank.org/v2/country/WLD/indicator/${code}`,
      {
        params: {
          format: "json",
          per_page: 1
        }
      }
    );

    result[name] =
      response.data?.[1]?.[0]?.value ?? null;
  }

  return result;
}