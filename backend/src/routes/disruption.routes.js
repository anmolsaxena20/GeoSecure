import { Router } from "express";
import {
  fetchMarketData,
  fetchNews,
  generateReport,
  getDisruptionScenarios,
  getReserveOptimisationData,
  getCommodityRiskScores,
  getCorridorRiskScores,
  getHighRiskEvents,
  runDisruptionAgent,
  runSupplyChainEconomiesAgent,
  runStrategicReserveAgent,
  runSupplyAgent,
} from "../controllers/ai.controller.js";

const router = Router();

router.get("/report", generateReport);
router.get("/market", fetchMarketData);
router.get("/news", fetchNews);
router.get("/scenarios", getDisruptionScenarios);
router.get("/reserve-optimisation", getReserveOptimisationData);
router.post("/disruption/run", runDisruptionAgent);
router.get("/disruption/corridors", getCorridorRiskScores);
router.get("/disruption/commodities", getCommodityRiskScores);
router.post("/economies/run", runSupplyChainEconomiesAgent);
router.get("/economies/high-risk-events", getHighRiskEvents);
router.post("/reserve/run", runStrategicReserveAgent);
router.post("/supply-agent/run", runSupplyAgent);

export { router as disruptionRouter };
