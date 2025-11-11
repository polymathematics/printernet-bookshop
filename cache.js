// Simple in-memory cache for frequently accessed data
// TTL-based expiration with automatic cleanup

class SimpleCache {
  constructor(defaultTTL = 60000) { // Default 60 seconds
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.timers = new Map();
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional, uses default if not provided)
   */
  set(key, value, ttl = null) {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    this.cache.set(key, { value, expiresAt });
    
    // Set timer to auto-delete when expired
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl || this.defaultTTL);
    
    this.timers.set(key, timer);
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number} - Number of items in cache
   */
  size() {
    return this.cache.size;
  }
}

// Create cache instances for different data types
const userCache = new SimpleCache(300000); // 5 minutes for users (usernames change rarely)
const bookCache = new SimpleCache(60000);  // 1 minute for books (more dynamic)

module.exports = {
  userCache,
  bookCache,
  SimpleCache
};

