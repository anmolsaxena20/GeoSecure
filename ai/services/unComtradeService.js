export async function fetchUNComtradeData(params = {}) {
  const apiKey = process.env.COMTRADE_API_KEY;
  const isPreview = !apiKey;
  const baseUrl = isPreview
    ? "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
    : "https://comtradeapi.un.org/data/v1/get/C/A/HS";

  const headers = {};
  if (apiKey) {
    headers["Ocp-Apim-Subscription-Key"] = apiKey;
  }

  const queryParams = new URLSearchParams();

  // Enforce correct parameters depending on mode
  if (isPreview) {
    // Public preview sandbox only contains data for Armenia (51) in 2025
    queryParams.append("reporterCode", "51");
    queryParams.append("period", "2025");
    // Partner code 0 represents 'World'
    queryParams.append("partnerCode", "0");
  } else {
    // Production authenticated API has full support
    queryParams.append("reporterCode", params.reporterCode || "all");
    queryParams.append("period", params.period || "2024");
    if (params.partnerCode) queryParams.append("partnerCode", params.partnerCode);
    if (params.flowCode) queryParams.append("flowCode", params.flowCode);
    if (params.cmdCode) queryParams.append("cmdCode", params.cmdCode);
  }

  const url = `${baseUrl}?${queryParams.toString()}`;
  console.log(`[comtrade] Fetching from URL: ${url}`);

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`UN Comtrade API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Process the trade records to make them clean and readable
  const records = (result.data || []).map(item => ({
    year: item.refYear || item.period,
    reporterCode: item.reporterCode,
    partnerCode: item.partnerCode,
    flow: item.flowCode === "M" ? "Import" : item.flowCode === "X" ? "Export" : item.flowCode,
    commodityCode: item.cmdCode,
    tradeValueUSD: item.primaryValue || item.cifvalue || item.fobvalue || 0
  }));

  // Limit quantity of returned data to fit token capacity limits
  return records.slice(0, 10);
}
