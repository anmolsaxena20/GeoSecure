import { Router } from "express";
import {
  fetchMarketData,
  fetchNews,
  generateReport,
  getCommodityRiskScores,
  getCorridorRiskScores,
  getHighRiskEvents,
  runDisruptionAgent,
  runSupplyChainEconomiesAgent,
} from "../controllers/ai.controller.js";

const router = Router();

router.get("/report", generateReport);
router.get("/market", fetchMarketData);
router.get("/news", fetchNews);
router.post("/disruption/run", runDisruptionAgent);
router.get("/disruption/corridors", getCorridorRiskScores);
router.get("/disruption/commodities", getCommodityRiskScores);
router.post("/economies/run", runSupplyChainEconomiesAgent);
router.get("/economies/high-risk-events", getHighRiskEvents);

export { router as disruptionRouter };
