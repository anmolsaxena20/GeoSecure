import { createClient } from "redis";
const client = await createClient({ url: process.env.REDIS_URL })
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

try {
  const response = await client.ping();
  console.log(response); // PONG

  console.log("Redis connected successfully!");
} catch (err) {
  console.error("Failed to connect to Redis:", err);
} finally {
  await client.quit();
}

export default client;
