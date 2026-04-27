// Jest setup file
require('dotenv').config({ path: '.env' });

// Set test environment
process.env.NODE_ENV = 'test';

// Override environment variables for testing
process.env.SALE_START_TIME = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago (active)
process.env.SALE_END_TIME = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
process.env.TOTAL_STOCK = '100';

// Increase timeout for all tests
jest.setTimeout(30000);

// Global test setup
beforeAll(() => {
  console.log('Starting flash sale tests...');
  console.log(`Test sale period: ${process.env.SALE_START_TIME} to ${process.env.SALE_END_TIME}`);
});

afterAll(() => {
  console.log('Flash sale tests completed');
});