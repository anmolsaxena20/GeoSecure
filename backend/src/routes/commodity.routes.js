import { Router } from "express";
import { getPinnedCommodities } from "../controllers/commodity.controller.js";

const router = Router();

router.get("/pinned", getPinnedCommodities);

export { router as commodityRouter };
