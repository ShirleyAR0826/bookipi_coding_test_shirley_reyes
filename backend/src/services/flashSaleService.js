const { getRedisClient, isRedisConnected, acquireLock, releaseLock } = require('../utils/redis');

// In-memory fallback for development without Redis
let inMemoryStore = {
  stock: parseInt(process.env.TOTAL_STOCK) || 1000,
  purchases: new Set(),
  purchaseQueue: []
};

class FlashSaleService {
  /**
   * Get current sale status
   */
  async getSaleStatus() {
    try {
      const now = new Date();
      const startTime = new Date(process.env.SALE_START_TIME);
      const endTime = new Date(process.env.SALE_END_TIME);
      const productId = process.env.PRODUCT_ID || 'limited-edition-flash-sale';

      let currentStock, totalStock, productName, productPrice;

      if (isRedisConnected()) {
        const redisClient = getRedisClient();
        currentStock = parseInt(await redisClient.get(`stock:${productId}`)) || 0;
        
        const config = await redisClient.hGetAll('sale:config');
        totalStock = parseInt(config.totalStock) || 1000;
        productName = config.productName || 'Limited Edition Flash Sale Item';
        productPrice = parseFloat(config.productPrice) || 99.99;
      } else {
        // Fallback to in-memory
        currentStock = inMemoryStore.stock;
        totalStock = parseInt(process.env.TOTAL_STOCK) || 1000;
        productName = process.env.PRODUCT_NAME || 'Limited Edition Flash Sale Item';
        productPrice = parseFloat(process.env.PRODUCT_PRICE) || 99.99;
      }

      // Determine sale status
      let status;
      if (now < startTime) {
        status = 'upcoming';
      } else if (now > endTime) {
        status = 'ended';
      } else if (currentStock <= 0) {
        status = 'sold-out';
      } else {
        status = 'active';
      }

      return {
        status,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        currentStock,
        totalStock,
        soldCount: totalStock - currentStock,
        product: {
          id: productId,
          name: productName,
          price: productPrice
        },
        serverTime: now.toISOString()
      };
    } catch (error) {
      console.error('Error getting sale status:', error);
      throw error;
    }
  }

  /**
   * Attempt to purchase item for a user
   */
  async attemptPurchase(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Normalize user ID
    userId = userId.toLowerCase().trim();

    // Check if sale is active
    const saleStatus = await this.getSaleStatus();
    if (saleStatus.status !== 'active') {
      return {
        success: false,
        message: this.getSaleStatusMessage(saleStatus.status),
        saleStatus
      };
    }

    // Check if user already purchased
    const existingPurchase = await this.getUserPurchase(userId);
    if (existingPurchase) {
      return {
        success: false,
        message: 'You have already purchased this item',
        purchase: existingPurchase,
        saleStatus
      };
    }

    // Attempt to acquire lock for purchase
    const lockKey = `purchase:lock:${userId}`;
    const lockValue = await acquireLock(lockKey, 5000); // 5 second lock

    if (!lockValue) {
      return {
        success: false,
        message: 'Purchase in progress, please wait...',
        saleStatus
      };
    }

    try {
      // Double-check user hasn't purchased while waiting for lock
      const doubleCheckPurchase = await this.getUserPurchase(userId);
      if (doubleCheckPurchase) {
        return {
          success: false,
          message: 'You have already purchased this item',
          purchase: doubleCheckPurchase,
          saleStatus
        };
      }

      // Attempt to decrement stock atomically
      const purchase = await this.processAtomicPurchase(userId);
      
      return {
        success: !!purchase,
        message: purchase ? 'Purchase successful!' : 'Item sold out',
        purchase,
        saleStatus: await this.getSaleStatus()
      };

    } finally {
      // Always release the lock
      await releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Process the actual purchase with atomic stock decrement
   */
  async processAtomicPurchase(userId) {
    const productId = process.env.PRODUCT_ID || 'limited-edition-flash-sale';
    const purchaseId = `purchase:${userId}:${Date.now()}`;
    const timestamp = new Date().toISOString();

    if (isRedisConnected()) {
      const redisClient = getRedisClient();

      // Use Lua script for atomic operation
      const luaScript = `
        local stockKey = KEYS[1]
        local purchaseKey = KEYS[2]
        local purchaseSetKey = KEYS[3]
        local userId = ARGV[1]
        local timestamp = ARGV[2]
        local productId = ARGV[3]
        local purchaseId = ARGV[4]

        -- Check current stock
        local currentStock = redis.call('GET', stockKey)
        if not currentStock or tonumber(currentStock) <= 0 then
          return {0, 'sold-out'}
        end

        -- Check if user already purchased
        local existingPurchase = redis.call('SISMEMBER', purchaseSetKey, userId)
        if existingPurchase == 1 then
          return {0, 'already-purchased'}
        end

        -- Decrement stock and record purchase
        redis.call('DECR', stockKey)
        redis.call('SADD', purchaseSetKey, userId)
        
        local purchaseData = {
          'id', purchaseId,
          'userId', userId,
          'productId', productId,
          'timestamp', timestamp,
          'price', '99.99'
        }
        redis.call('HMSET', purchaseKey, unpack(purchaseData))
        redis.call('EXPIRE', purchaseKey, 86400) -- 24 hour TTL

        return {1, 'success'}
      `;

      const result = await redisClient.eval(luaScript, {
        keys: [
          `stock:${productId}`,
          `purchase:${userId}`,
          `purchases:${productId}`
        ],
        arguments: [userId, timestamp, productId, purchaseId]
      });

      if (result[0] === 1) {
        return {
          id: purchaseId,
          userId,
          productId,
          timestamp,
          price: 99.99
        };
      } else {
        return null;
      }

    } else {
      // Fallback to in-memory (not thread-safe, for development only)
      if (inMemoryStore.stock <= 0) {
        return null;
      }

      if (inMemoryStore.purchases.has(userId)) {
        return null;
      }

      inMemoryStore.stock--;
      inMemoryStore.purchases.add(userId);
      
      const purchase = {
        id: purchaseId,
        userId,
        productId,
        timestamp,
        price: 99.99
      };
      
      inMemoryStore.purchaseQueue.push(purchase);
      return purchase;
    }
  }

  /**
   * Get user's purchase if exists
   */
  async getUserPurchase(userId) {
    if (!userId) return null;

    userId = userId.toLowerCase().trim();

    if (isRedisConnected()) {
      const redisClient = getRedisClient();
      const purchaseData = await redisClient.hGetAll(`purchase:${userId}`);
      
      if (purchaseData && purchaseData.id) {
        return {
          id: purchaseData.id,
          userId: purchaseData.userId,
          productId: purchaseData.productId,
          timestamp: purchaseData.timestamp,
          price: parseFloat(purchaseData.price)
        };
      }
      return null;
    } else {
      // Fallback to in-memory
      return inMemoryStore.purchaseQueue.find(p => p.userId === userId) || null;
    }
  }

  /**
   * Get sale status message based on status
   */
  getSaleStatusMessage(status) {
    switch (status) {
      case 'upcoming':
        return 'Sale has not started yet';
      case 'ended':
        return 'Sale has ended';
      case 'sold-out':
        return 'Item is sold out';
      case 'active':
        return 'Sale is active';
      default:
        return 'Unknown sale status';
    }
  }

  /**
   * Reset sale data (for testing)
   */
  async resetSaleData() {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      throw new Error('Reset only allowed in development/test environment');
    }

    const productId = process.env.PRODUCT_ID || 'limited-edition-flash-sale';
    const totalStock = parseInt(process.env.TOTAL_STOCK) || 1000;

    if (isRedisConnected()) {
      const redisClient = getRedisClient();
      
      // Reset stock
      await redisClient.set(`stock:${productId}`, totalStock);
      
      // Clear purchases
      const purchaseKeys = await redisClient.keys(`purchase:*`);
      if (purchaseKeys.length > 0) {
        await redisClient.del(purchaseKeys);
      }
      
      await redisClient.del(`purchases:${productId}`);
    } else {
      // Reset in-memory store
      inMemoryStore.stock = totalStock;
      inMemoryStore.purchases.clear();
      inMemoryStore.purchaseQueue = [];
    }

    console.log('Sale data reset successfully');
  }
}

module.exports = new FlashSaleService();