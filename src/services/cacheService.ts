import redisClient from "../config/redis";

export class CacheService {
  private static instance: CacheService;
  private cacheStats: {
    hits: number;
    misses: number;
    keys: Set<string>;
  };

  private constructor() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      keys: new Set(),
    };
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      ...this.cacheStats,
      totalKeys: this.cacheStats.keys.size,
      hitRate: this.calculateHitRate(),
    };
  }

  /**
   * Record cache hit
   */
  public recordHit(key: string) {
    this.cacheStats.hits++;
    this.cacheStats.keys.add(key);
  }

  /**
   * Record cache miss
   */
  public recordMiss(key: string) {
    this.cacheStats.misses++;
    this.cacheStats.keys.add(key);
  }

  /**
   * Calculate cache hit rate
   */
  private calculateHitRate(): number {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total === 0 ? 0 : (this.cacheStats.hits / total) * 100;
  }

  /**
   * Clear all cache entries
   */
  public async clearAll(): Promise<void> {
    try {
      const keys = await redisClient.keys("cache:*");
      if (keys.length > 0) {
        await redisClient.del(keys);
        this.cacheStats.keys.clear();
        console.log(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }

  /**
   * Get frequently accessed keys
   */
  public getHotKeys(threshold: number = 10): string[] {
    const keyHits = Array.from(this.cacheStats.keys).map((key) => ({
      key,
      hits: this.cacheStats.hits,
    }));

    return keyHits
      .filter((item) => item.hits >= threshold)
      .map((item) => item.key);
  }

  /**
   * Warm up frequently accessed cache entries
   */
  public async warmHotKeys(): Promise<void> {
    const hotKeys = this.getHotKeys();
    for (const key of hotKeys) {
      try {
        const value = await redisClient.get(key);
        if (value) {
          await redisClient.setEx(key, 3600, value); // Refresh for 1 hour
          console.log(`Warmed cache for hot key: ${key}`);
        }
      } catch (error) {
        console.error(`Error warming cache for key ${key}:`, error);
      }
    }
  }
}
