import { Router } from "express";
import {
  getProcurementRecommendations,
  runProcurementOrchestrator,
} from "../controllers/ai.controller.js";

const router = Router();

router.post("/run", runProcurementOrchestrator);
router.get("/recommendations", getProcurementRecommendations);

export { router as procurementRouter };