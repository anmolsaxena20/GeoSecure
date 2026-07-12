import { SupplyChainCopilot, ensureCopilotTablesExist } from "./supply_chain_copilot.js";

// Singleton copilot instance (lazy-initialized)
let copilotInstance = null;

function getCopilot() {
  if (!copilotInstance) {
    copilotInstance = new SupplyChainCopilot();
  }
  return copilotInstance;
}

/**
 * POST /api/ai/copilot/chat
 * Body: { sessionId: number, userId?: number, message: string }
 *
 * Sends a user message to the copilot and returns the AI response.
 */
export async function chatWithCopilot(req, res, next) {
  try {
    const { sessionId, userId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, message",
      });
    }

    const copilot = getCopilot();
    const result = await copilot.chat(message, sessionId, userId || null);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/ai/copilot/sessions
 * Body: { userId: number, title?: string }
 *
 * Creates a new chat session for the user.
 */
export async function createSession(req, res, next) {
  try {
    const { userId, title } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "Missing required field: userId",
      });
    }

    const copilot = getCopilot();
    const session = await copilot.createSession(userId, title);

    return res.status(201).json(session);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/ai/copilot/sessions/:userId
 *
 * Returns all chat sessions for a given user.
 */
export async function getUserSessions(req, res, next) {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const copilot = getCopilot();
    const sessions = await copilot.getUserSessions(userId);

    return res.status(200).json(sessions);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/ai/copilot/sessions/:sessionId/messages
 *
 * Returns all messages in a chat session.
 */
export async function getSessionMessages(req, res, next) {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" });
    }

    const copilot = getCopilot();
    const messages = await copilot.getSessionMessages(sessionId);

    return res.status(200).json(messages);
  } catch (error) {
    return next(error);
  }
}

// Initialize table verification on import
ensureCopilotTablesExist().catch((err) => {
  console.warn("[copilotController] Table verification warning:", err.message);
});
