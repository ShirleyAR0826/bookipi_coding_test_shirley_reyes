const request = require('supertest');
const app = require('../src/app');

describe('Flash Sale API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'OK');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/flash-sale/status', () => {
    it('should return sale status', async () => {
      const res = await request(app)
        .get('/api/flash-sale/status')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('currentStock');
      expect(res.body.data).toHaveProperty('product');
    });
  });

  describe('GET /api/flash-sale/config', () => {
    it('should return sale configuration', async () => {
      const res = await request(app)
        .get('/api/flash-sale/config')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('saleStartTime');
      expect(res.body.data).toHaveProperty('saleEndTime');
      expect(res.body.data).toHaveProperty('totalStock');
      expect(res.body.data).toHaveProperty('product');
    });
  });

  describe('POST /api/flash-sale/purchase', () => {
    beforeEach(async () => {
      // Reset sale data before each test
      if (process.env.NODE_ENV === 'test') {
        await request(app).post('/api/flash-sale/reset');
      }
    });

    it('should require userId', async () => {
      const res = await request(app)
        .post('/api/flash-sale/purchase')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid userId type', async () => {
      const res = await request(app)
        .post('/api/flash-sale/purchase')
        .send({ userId: 123 })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('should process valid purchase attempt', async () => {
      const res = await request(app)
        .post('/api/flash-sale/purchase')
        .send({ userId: 'test-user-1' });

      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');
    });

    it('should prevent duplicate purchases from same user', async () => {
      const userId = 'test-user-duplicate';
      
      // First purchase attempt
      const res1 = await request(app)
        .post('/api/flash-sale/purchase')
        .send({ userId });

      // Second purchase attempt
      const res2 = await request(app)
        .post('/api/flash-sale/purchase')
        .send({ userId })
        .expect(409);

      expect(res2.body).toHaveProperty('success', false);
      expect(res2.body.message).toMatch(/already purchased/i);
    });
  });

  describe('GET /api/flash-sale/purchase/:userId', () => {
    it('should return purchase status for user', async () => {
      const userId = 'test-user-check';
      
      const res = await request(app)
        .get(`/api/flash-sale/purchase/${userId}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('hasPurchased');
      expect(res.body.data).toHaveProperty('purchase');
      expect(res.body.data).toHaveProperty('saleStatus');
    });

    it('should handle encoded user IDs', async () => {
      const userId = 'test@example.com';
      
      const res = await request(app)
        .get(`/api/flash-sale/purchase/${encodeURIComponent(userId)}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/flash-sale/reset', () => {
    it('should reset sale data in development', async () => {
      if (process.env.NODE_ENV === 'production') {
        const res = await request(app)
          .post('/api/flash-sale/reset')
          .expect(403);
        
        expect(res.body).toHaveProperty('success', false);
      } else {
        const res = await request(app)
          .post('/api/flash-sale/reset')
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message');
      }
    });
  });

  describe('Error handling', () => {
    it('should handle 404 routes', async () => {
      const res = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(res.body).toHaveProperty('error', 'Route not found');
    });

    it('should handle rate limiting', async () => {
      // This test would need multiple rapid requests to trigger rate limiting
      // Implementation depends on test environment setup
    });
  });
});