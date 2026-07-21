import { Router } from "express";
import {
  chatWithCopilot,
  createSession,
  getSessionMessages,
  getUserSessions,
} from "../controllers/copilot.controller.js";

const router = Router();

router.post("/chat", chatWithCopilot);
router.post("/sessions", createSession);
router.get("/sessions", getUserSessions);
router.get("/sessions/:sessionId/messages", getSessionMessages);

export { router as copilotRouter };
