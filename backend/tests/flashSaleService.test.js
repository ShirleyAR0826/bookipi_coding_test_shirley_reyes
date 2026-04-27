const flashSaleService = require('../src/services/flashSaleService');

describe('FlashSaleService', () => {
  beforeEach(async () => {
    // Reset sale data before each test
    if (process.env.NODE_ENV === 'test') {
      await flashSaleService.resetSaleData();
    }
  });

  describe('getSaleStatus', () => {
    it('should return valid sale status structure', async () => {
      const status = await flashSaleService.getSaleStatus();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('startTime');
      expect(status).toHaveProperty('endTime');
      expect(status).toHaveProperty('currentStock');
      expect(status).toHaveProperty('totalStock');
      expect(status).toHaveProperty('soldCount');
      expect(status).toHaveProperty('product');
      expect(status).toHaveProperty('serverTime');

      expect(typeof status.currentStock).toBe('number');
      expect(typeof status.totalStock).toBe('number');
      expect(typeof status.soldCount).toBe('number');
      expect(status.soldCount).toBe(status.totalStock - status.currentStock);
    });

    it('should return correct sale status based on time', async () => {
      const status = await flashSaleService.getSaleStatus();
      const now = new Date();
      const startTime = new Date(process.env.SALE_START_TIME);
      const endTime = new Date(process.env.SALE_END_TIME);

      if (now < startTime) {
        expect(status.status).toBe('upcoming');
      } else if (now > endTime) {
        expect(status.status).toBe('ended');
      } else if (status.currentStock <= 0) {
        expect(status.status).toBe('sold-out');
      } else {
        expect(status.status).toBe('active');
      }
    });
  });

  describe('attemptPurchase', () => {
    it('should require userId', async () => {
      await expect(flashSaleService.attemptPurchase()).rejects.toThrow('User ID is required');
      await expect(flashSaleService.attemptPurchase('')).rejects.toThrow('User ID is required');
      await expect(flashSaleService.attemptPurchase(null)).rejects.toThrow('User ID is required');
    });

    it('should normalize userId', async () => {
      const userId1 = '  TEST@EXAMPLE.COM  ';
      const userId2 = 'test@example.com';
      
      const result1 = await flashSaleService.attemptPurchase(userId1);
      const result2 = await flashSaleService.attemptPurchase(userId2);
      
      // Second attempt should fail as duplicate
      if (result1.success) {
        expect(result2.success).toBe(false);
        expect(result2.message).toMatch(/already purchased/i);
      }
    });

    it('should prevent duplicate purchases', async () => {
      const userId = 'duplicate-test-user';
      
      const result1 = await flashSaleService.attemptPurchase(userId);
      const result2 = await flashSaleService.attemptPurchase(userId);
      
      if (result1.success) {
        expect(result2.success).toBe(false);
        expect(result2.message).toMatch(/already purchased/i);
      }
    });

    it('should return purchase object on success', async () => {
      const userId = 'success-test-user';
      const result = await flashSaleService.attemptPurchase(userId);
      
      if (result.success) {
        expect(result.purchase).toHaveProperty('id');
        expect(result.purchase).toHaveProperty('userId', userId);
        expect(result.purchase).toHaveProperty('productId');
        expect(result.purchase).toHaveProperty('timestamp');
        expect(result.purchase).toHaveProperty('price');
      }
    });

    it('should include sale status in response', async () => {
      const userId = 'status-test-user';
      const result = await flashSaleService.attemptPurchase(userId);
      
      expect(result).toHaveProperty('saleStatus');
      expect(result.saleStatus).toHaveProperty('status');
      expect(result.saleStatus).toHaveProperty('currentStock');
    });
  });

  describe('getUserPurchase', () => {
    it('should return null for non-existent purchase', async () => {
      const purchase = await flashSaleService.getUserPurchase('non-existent-user');
      expect(purchase).toBeNull();
    });

    it('should return purchase data for existing purchase', async () => {
      const userId = 'existing-purchase-user';
      
      // First create a purchase
      const purchaseResult = await flashSaleService.attemptPurchase(userId);
      
      if (purchaseResult.success) {
        // Then check if we can retrieve it
        const purchase = await flashSaleService.getUserPurchase(userId);
        
        expect(purchase).not.toBeNull();
        expect(purchase).toHaveProperty('id');
        expect(purchase).toHaveProperty('userId', userId);
        expect(purchase).toHaveProperty('productId');
        expect(purchase).toHaveProperty('timestamp');
        expect(purchase).toHaveProperty('price');
      }
    });

    it('should handle null/undefined userId', async () => {
      const purchase1 = await flashSaleService.getUserPurchase(null);
      const purchase2 = await flashSaleService.getUserPurchase(undefined);
      
      expect(purchase1).toBeNull();
      expect(purchase2).toBeNull();
    });
  });

  describe('getSaleStatusMessage', () => {
    it('should return correct messages for different statuses', () => {
      expect(flashSaleService.getSaleStatusMessage('upcoming')).toBe('Sale has not started yet');
      expect(flashSaleService.getSaleStatusMessage('ended')).toBe('Sale has ended');
      expect(flashSaleService.getSaleStatusMessage('sold-out')).toBe('Item is sold out');
      expect(flashSaleService.getSaleStatusMessage('active')).toBe('Sale is active');
      expect(flashSaleService.getSaleStatusMessage('unknown')).toBe('Unknown sale status');
    });
  });

  describe('resetSaleData', () => {
    it('should only work in development/test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'production';
        await expect(flashSaleService.resetSaleData()).rejects.toThrow('Reset only allowed in development/test environment');
        
        process.env.NODE_ENV = 'test';
        await expect(flashSaleService.resetSaleData()).resolves.not.toThrow();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should reset stock and purchases', async () => {
      // Make a purchase first
      const userId = 'reset-test-user';
      await flashSaleService.attemptPurchase(userId);
      
      // Reset the data
      await flashSaleService.resetSaleData();
      
      // Check that purchase is gone and stock is reset
      const purchase = await flashSaleService.getUserPurchase(userId);
      const status = await flashSaleService.getSaleStatus();
      
      expect(purchase).toBeNull();
      expect(status.currentStock).toBe(parseInt(process.env.TOTAL_STOCK) || 1000);
      expect(status.soldCount).toBe(0);
    });
  });
});

// Integration tests with concurrency
describe('FlashSaleService Concurrency', () => {
  beforeEach(async () => {
    if (process.env.NODE_ENV === 'test') {
      await flashSaleService.resetSaleData();
    }
  });

  it('should handle multiple simultaneous purchases correctly', async () => {
    const userIds = Array.from({ length: 50 }, (_, i) => `concurrent-user-${i}`);
    
    // Attempt purchases simultaneously
    const promises = userIds.map(userId => 
      flashSaleService.attemptPurchase(userId)
    );
    
    const results = await Promise.all(promises);
    
    // Count successful purchases
    const successfulPurchases = results.filter(r => r.success);
    const failedPurchases = results.filter(r => !r.success);
    
    // Verify no overselling occurred
    const finalStatus = await flashSaleService.getSaleStatus();
    const expectedSoldCount = successfulPurchases.length;
    
    expect(finalStatus.soldCount).toBe(expectedSoldCount);
    expect(finalStatus.currentStock).toBe(finalStatus.totalStock - expectedSoldCount);
    
    // Verify all successful purchases are unique
    const purchaseIds = successfulPurchases.map(p => p.purchase.id);
    const uniquePurchaseIds = new Set(purchaseIds);
    expect(uniquePurchaseIds.size).toBe(purchaseIds.length);
    
    console.log(`Concurrent test: ${successfulPurchases.length} successful, ${failedPurchases.length} failed`);
  }, 30000); // Increased timeout for concurrency test
});