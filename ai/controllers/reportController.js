import { fetchAllNews } from "./newsController.js";
import { fetchMarketData } from "./marketController.js";
import { buildReport } from "../services/reportService.js";

export async function generateSupplyChainReport() {
    const news = await fetchAllNews();

    const market = await fetchMarketData();

    return await buildReport(news, market);
}