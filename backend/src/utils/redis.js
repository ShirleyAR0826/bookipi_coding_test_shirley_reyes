const redis = require('redis');

let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = redis.createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        connectTimeout: 60000,
        lazyConnect: true,
      },
      retry_delay_on_failover: 100,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      console.log('Redis client ready');
    });

    redisClient.on('end', () => {
      console.log('Redis client disconnected');
      isConnected = false;
    });

    await redisClient.connect();
    
    // Initialize flash sale data
    await initializeFlashSaleData();
    
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    // Fallback to in-memory storage for development
    console.warn('Falling back to in-memory storage');
    return null;
  }
}

/**
 * Initialize flash sale data in Redis
 */
async function initializeFlashSaleData() {
  if (!redisClient) return;

  try {
    const totalStock = parseInt(process.env.TOTAL_STOCK) || 1000;
    const productId = process.env.PRODUCT_ID || 'limited-edition-flash-sale';
    
    // Set initial stock if not exists
    const stockExists = await redisClient.exists(`stock:${productId}`);
    if (!stockExists) {
      await redisClient.set(`stock:${productId}`, totalStock);
      console.log(`Initialized stock for ${productId}: ${totalStock}`);
    }

    // Set sale configuration
    await redisClient.hSet('sale:config', {
      startTime: process.env.SALE_START_TIME,
      endTime: process.env.SALE_END_TIME,
      productId: productId,
      productName: process.env.PRODUCT_NAME || 'Limited Edition Flash Sale Item',
      productPrice: process.env.PRODUCT_PRICE || '99.99',
      totalStock: totalStock.toString()
    });

  } catch (error) {
    console.error('Failed to initialize flash sale data:', error);
  }
}

/**
 * Get Redis client instance
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
  return isConnected && redisClient && redisClient.isReady;
}

/**
 * Execute atomic operation using Redis transaction
 */
async function executeTransaction(operations) {
  if (!redisClient || !isConnected) {
    throw new Error('Redis not available');
  }

  const multi = redisClient.multi();
  
  for (const operation of operations) {
    multi[operation.command](...operation.args);
  }
  
  return await multi.exec();
}

/**
 * Acquire distributed lock
 */
async function acquireLock(lockKey, ttl = 5000) {
  if (!redisClient || !isConnected) {
    return null;
  }

  const lockValue = `${Date.now()}-${Math.random()}`;
  const result = await redisClient.set(lockKey, lockValue, {
    PX: ttl, // TTL in milliseconds
    NX: true  // Only set if not exists
  });

  return result === 'OK' ? lockValue : null;
}

/**
 * Release distributed lock
 */
async function releaseLock(lockKey, lockValue) {
  if (!redisClient || !isConnected || !lockValue) {
    return false;
  }

  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redisClient.eval(script, {
    keys: [lockKey],
    arguments: [lockValue]
  });

  return result === 1;
}

module.exports = {
  initializeRedis,
  getRedisClient,
  isRedisConnected,
  executeTransaction,
  acquireLock,
  releaseLock
};