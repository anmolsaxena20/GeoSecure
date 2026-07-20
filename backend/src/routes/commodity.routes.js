import { Router } from "express";
import {
  getPinnedCommodities,
  deletePinnedCommodity,
} from "../controllers/commodity.controller.js";

const router = Router();

router.get("/pinned", getPinnedCommodities);
router.delete("/pinned", deletePinnedCommodity);
export { router as commodityRouter };
