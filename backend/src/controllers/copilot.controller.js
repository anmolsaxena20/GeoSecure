import { aiHttpCall } from "../config/ai.config.js";
import { getRedisClient } from "../config/redis.config.js";

const COPILOT_CACHE_TTL_SECONDS = 60;

const parseCachedValue = (value) => {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const chatWithCopilot = async (req, res, next) => {
  try {
    const { sessionId, message } = req.body;
    const userId = req.user?.id;

    if (!sessionId || !message) {
      return res.status(400).json({ message: "Missing required fields: sessionId, message" });
    }

    const result = await aiHttpCall("CopilotChat", { sessionId, userId, message });

    // Invalidate session messages cache
    const redisClient = await getRedisClient();
    if (redisClient) {
      try {
        await redisClient.del(`cache:copilot:session:${sessionId}:messages`);
      } catch (error) {
        console.error(`Failed to invalidate cache for session ${sessionId}:`, error);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export const createSession = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { title } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Missing required user identity" });
    }

    const session = await aiHttpCall("CreateCopilotSession", { userId, title });

    // Invalidate user sessions cache
    const redisClient = await getRedisClient();
    if (redisClient) {
      try {
        await redisClient.del(`cache:copilot:user:${userId}:sessions`);
      } catch (error) {
        console.error(`Failed to invalidate user sessions cache for user ${userId}:`, error);
      }
    }

    return res.status(201).json(session);
  } catch (error) {
    return next(error);
  }
};

export const getUserSessions = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({ message: "Missing required user identity" });
    }

    const cacheKey = `cache:copilot:user:${userId}:sessions`;
    const redisClient = await getRedisClient();

    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached !== null) {
          return res.status(200).json(parseCachedValue(cached));
        }
      } catch (error) {
        console.error(`Redis read failed for key ${cacheKey}:`, error);
      }
    }

    const sessions = await aiHttpCall("GetCopilotUserSessions", {}, { userId });

    if (redisClient && sessions) {
      try {
        await redisClient.setEx(cacheKey, COPILOT_CACHE_TTL_SECONDS, JSON.stringify(sessions));
      } catch (error) {
        console.error(`Redis write failed for key ${cacheKey}:`, error);
      }
    }

    return res.status(200).json(sessions);
  } catch (error) {
    return next(error);
  }
};

export const getSessionMessages = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    if (!sessionId) {
      return res.status(400).json({ message: "Missing sessionId parameter" });
    }

    const cacheKey = `cache:copilot:session:${sessionId}:messages`;
    const redisClient = await getRedisClient();

    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached !== null) {
          return res.status(200).json(parseCachedValue(cached));
        }
      } catch (error) {
        console.error(`Redis read failed for key ${cacheKey}:`, error);
      }
    }

    const messages = await aiHttpCall("GetCopilotSessionMessages", {}, { sessionId });

    if (redisClient && messages) {
      try {
        await redisClient.setEx(cacheKey, COPILOT_CACHE_TTL_SECONDS, JSON.stringify(messages));
      } catch (error) {
        console.error(`Redis write failed for key ${cacheKey}:`, error);
      }
    }

    return res.status(200).json(messages);
  } catch (error) {
    return next(error);
  }
};
