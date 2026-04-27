const express = require('express');
const flashSaleService = require('../services/flashSaleService');

const router = express.Router();

/**
 * GET /api/flash-sale/status
 * Get current flash sale status
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await flashSaleService.getSaleStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/flash-sale/purchase
 * Attempt to purchase item
 * Body: { userId: string }
 */
router.post('/purchase', async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'User ID is required and must be a string'
      });
    }

    const result = await flashSaleService.attemptPurchase(userId);
    
    // Set appropriate status code based on result
    const statusCode = result.success ? 200 : 
                      result.message.includes('already purchased') ? 409 :
                      result.message.includes('sold out') ? 410 :
                      result.message.includes('not started') || result.message.includes('ended') ? 400 : 400;

    res.status(statusCode).json({
      success: result.success,
      message: result.message,
      data: {
        purchase: result.purchase,
        saleStatus: result.saleStatus
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flash-sale/purchase/:userId
 * Check user's purchase status
 */
router.get('/purchase/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const purchase = await flashSaleService.getUserPurchase(userId);
    const saleStatus = await flashSaleService.getSaleStatus();

    res.json({
      success: true,
      data: {
        purchase,
        hasPurchased: !!purchase,
        saleStatus
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/flash-sale/reset
 * Reset sale data (development/testing only)
 */
router.post('/reset', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Reset not allowed in production'
      });
    }

    await flashSaleService.resetSaleData();
    
    res.json({
      success: true,
      message: 'Sale data reset successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flash-sale/config
 * Get sale configuration (public info)
 */
router.get('/config', async (req, res, next) => {
  try {
    const config = {
      saleStartTime: process.env.SALE_START_TIME,
      saleEndTime: process.env.SALE_END_TIME,
      totalStock: parseInt(process.env.TOTAL_STOCK) || 1000,
      product: {
        id: process.env.PRODUCT_ID || 'limited-edition-flash-sale',
        name: process.env.PRODUCT_NAME || 'Limited Edition Flash Sale Item',
        price: parseFloat(process.env.PRODUCT_PRICE) || 99.99
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;