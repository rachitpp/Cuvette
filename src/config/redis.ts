import { createClient } from "redis";

const REDIS_URL =
  "redis://default:6vZLMldS4PHS0t3JWxpjubvDQjupe8xE@redis-19270.crce179.ap-south-1-1.ec2.redns.redis-cloud.com:19270";

// Create the Redis client
const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries: number) => {
      const delay = Math.min(retries * 50, 2000);
      return delay;
    },
  },
});

// Set up event handlers
redisClient.on("error", (err: Error) => {
  console.error("Redis connection error:", err);
});

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

redisClient.on("reconnecting", () => {
  console.log("Reconnecting to Redis...");
});

// Connect immediately
redisClient.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
});

// Initialize Redis connection (for compatibility with existing code)
export const initRedis = async (): Promise<void> => {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
      console.log("Redis initialized successfully");
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      throw error;
    }
  }
};

export default redisClient;
