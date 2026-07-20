import { Router } from "express";
import {
  getPinnedCommodities,
  deletePinnedCommodity,
  pinCommodity,
  showAvailableCommodities,
} from "../controllers/commodity.controller.js";

const router = Router();

router.get("/pinned", getPinnedCommodities);
router.delete("/pinned", deletePinnedCommodity);
router.post("/pinned", pinCommodity);
router.get("/commodities", showAvailableCommodities);
export { router as commodityRouter };
