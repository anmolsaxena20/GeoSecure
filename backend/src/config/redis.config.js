import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

const client = createClient({ url: redisUrl });

client.on("error", (err) => {
  console.log("Redis Client Error", err);
});

let connectionPromise = null;

export const getRedisClient = async () => {
  if (!redisUrl) {
    return null;
  }

  if (client.isReady) {
    return client;
  }

  if (!connectionPromise) {
    connectionPromise = client.connect().catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }

  try {
    await connectionPromise;
    return client;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    return null;
  }
};

export default client;
