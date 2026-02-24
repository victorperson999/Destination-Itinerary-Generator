import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

declare global {
  var __redisClient: RedisClient | undefined;
  var __redisPromise: Promise<RedisClient | null> | undefined;
}

/**
 * Returns a connected Redis client, or null if REDIS_URL isn't set
 * or Redis isn't reachable. Never throws.
 */
export async function getRedis(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (global.__redisClient) return global.__redisClient;
  if (global.__redisPromise) return global.__redisPromise;

  const client = createClient({ url });

  client.on("error", (err) => {
    console.error("[redis] error", err);
  });

  global.__redisPromise = client
    .connect()
    .then(() => {
      global.__redisClient = client;
      console.log("[redis] connected");
      return client;
    })
    .catch((e) => {
      console.error("[redis] connect failed (caching disabled)", e);
      global.__redisPromise = undefined;
      try {
        client.disconnect();
      } catch {}
      return null;
    });

  return global.__redisPromise;
}