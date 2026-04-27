const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS) || 500;
const TEST_DURATION_MS = parseInt(process.env.TEST_DURATION_MS) || 30000;

class StressTestRunner {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successfulPurchases: 0,
      duplicatePurchases: 0,
      soldOutResponses: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: [],
      startTime: null,
      endTime: null,
      responseTimeDistribution: {
        '< 100ms': 0,
        '100-500ms': 0,
        '500ms-1s': 0,
        '> 1s': 0
      }
    };
  }

  async resetSaleData() {
    try {
      console.log('Resetting sale data...');
      const response = await axios.post(`${BASE_URL}/api/flash-sale/reset`);
      if (response.data.success) {
        console.log('Sale data reset successfully');
      }
    } catch (error) {
      console.error('Failed to reset sale data:', error.message);
    }
  }

  async getSaleStatus() {
    try {
      const response = await axios.get(`${BASE_URL}/api/flash-sale/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to get sale status:', error.message);
      return null;
    }
  }

  async attemptPurchase(userId) {
    const startTime = performance.now();
    
    try {
      const response = await axios.post(`${BASE_URL}/api/flash-sale/purchase`, {
        userId: `stress-test-user-${userId}`
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.updateResponseTimeStats(responseTime);
      this.results.totalRequests++;
      this.results.successfulRequests++;
      
      if (response.data.success) {
        this.results.successfulPurchases++;
      } else if (response.data.message.includes('already purchased')) {
        this.results.duplicatePurchases++;
      } else if (response.data.message.includes('sold out')) {
        this.results.soldOutResponses++;
      }
      
      return {
        success: true,
        data: response.data,
        responseTime
      };
      
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.updateResponseTimeStats(responseTime);
      this.results.totalRequests++;
      this.results.failedRequests++;
      
      // Handle HTTP errors (like 409, 410) as valid responses
      if (error.response && error.response.data) {
        this.results.successfulRequests++;
        
        if (error.response.data.message && error.response.data.message.includes('already purchased')) {
          this.results.duplicatePurchases++;
        } else if (error.response.data.message && error.response.data.message.includes('sold out')) {
          this.results.soldOutResponses++;
        }
        
        return {
          success: true,
          data: error.response.data,
          responseTime
        };
      }
      
      this.results.errors.push({
        userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message,
        responseTime
      };
    }
  }

  updateResponseTimeStats(responseTime) {
    this.results.averageResponseTime = 
      (this.results.averageResponseTime * (this.results.totalRequests - 1) + responseTime) / this.results.totalRequests;
    
    this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
    this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
    
    if (responseTime < 100) {
      this.results.responseTimeDistribution['< 100ms']++;
    } else if (responseTime < 500) {
      this.results.responseTimeDistribution['100-500ms']++;
    } else if (responseTime < 1000) {
      this.results.responseTimeDistribution['500ms-1s']++;
    } else {
      this.results.responseTimeDistribution['> 1s']++;
    }
  }

  async runConcurrentPurchaseTest() {
    console.log(`Starting stress test with ${CONCURRENT_USERS} concurrent users...`);
    console.log(`Test duration: ${TEST_DURATION_MS}ms`);
    console.log(`Target URL: ${BASE_URL}`);
    
    this.results.startTime = new Date();
    
    // Reset sale data before test
    await this.resetSaleData();
    
    // Get initial status
    const initialStatus = await this.getSaleStatus();
    console.log(`Initial stock: ${initialStatus?.data?.currentStock || 'Unknown'}`);
    
    const promises = [];
    const startTime = Date.now();
    
    // Create concurrent users
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      promises.push(this.simulateUser(i, startTime));
    }
    
    // Wait for all users to complete
    await Promise.all(promises);
    
    this.results.endTime = new Date();
    
    // Get final status
    const finalStatus = await this.getSaleStatus();
    
    return {
      testResults: this.results,
      initialStatus: initialStatus?.data,
      finalStatus: finalStatus?.data
    };
  }

  async simulateUser(userId, startTime) {
    const endTime = startTime + TEST_DURATION_MS;
    
    while (Date.now() < endTime) {
      await this.attemptPurchase(userId);
      
      // Small delay between requests to simulate realistic behavior
      await this.sleep(Math.random() * 100 + 50); // 50-150ms delay
    }
  }

  async runBurstTest() {
    console.log(`Running burst test with ${CONCURRENT_USERS} simultaneous requests...`);
    
    this.results.startTime = new Date();
    
    // Reset sale data before test
    await this.resetSaleData();
    
    // Get initial status
    const initialStatus = await this.getSaleStatus();
    console.log(`Initial stock: ${initialStatus?.data?.currentStock || 'Unknown'}`);
    
    // Create all requests simultaneously
    const promises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      promises.push(this.attemptPurchase(i));
    }
    
    // Wait for all requests to complete
    await Promise.all(promises);
    
    this.results.endTime = new Date();
    
    // Get final status
    const finalStatus = await this.getSaleStatus();
    
    return {
      testResults: this.results,
      initialStatus: initialStatus?.data,
      finalStatus: finalStatus?.data
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults(results) {
    const { testResults, initialStatus, finalStatus } = results;
    const duration = (testResults.endTime - testResults.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('STRESS TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Test Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${testResults.totalRequests}`);
    console.log(`Successful Requests: ${testResults.successfulRequests}`);
    console.log(`Failed Requests: ${testResults.failedRequests}`);
    console.log(`Success Rate: ${((testResults.successfulRequests / testResults.totalRequests) * 100).toFixed(2)}%`);
    
    console.log('\nPurchase Results:');
    console.log(`Successful Purchases: ${testResults.successfulPurchases}`);
    console.log(`Duplicate Purchase Attempts: ${testResults.duplicatePurchases}`);
    console.log(`Sold Out Responses: ${testResults.soldOutResponses}`);
    
    console.log('\nStock Verification:');
    console.log(`Initial Stock: ${initialStatus?.currentStock || 'Unknown'}`);
    console.log(`Final Stock: ${finalStatus?.currentStock || 'Unknown'}`);
    console.log(`Items Sold: ${(initialStatus?.currentStock || 0) - (finalStatus?.currentStock || 0)}`);
    
    if (testResults.successfulPurchases !== ((initialStatus?.currentStock || 0) - (finalStatus?.currentStock || 0))) {
      console.log('⚠️  WARNING: Purchase count does not match stock reduction!');
    } else {
      console.log('✅ Stock integrity verified - no overselling detected');
    }
    
    console.log('\nPerformance:');
    console.log(`Requests/sec: ${(testResults.totalRequests / duration).toFixed(2)}`);
    console.log(`Avg Response Time: ${testResults.averageResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${testResults.minResponseTime.toFixed(2)}ms`);
    console.log(`Max Response Time: ${testResults.maxResponseTime.toFixed(2)}ms`);
    
    console.log('\nResponse Time Distribution:');
    Object.entries(testResults.responseTimeDistribution).forEach(([range, count]) => {
      const percentage = ((count / testResults.totalRequests) * 100).toFixed(1);
      console.log(`${range}: ${count} (${percentage}%)`);
    });
    
    if (testResults.errors.length > 0) {
      console.log('\nErrors:');
      testResults.errors.slice(0, 5).forEach(error => {
        console.log(`User ${error.userId}: ${error.error}`);
      });
      if (testResults.errors.length > 5) {
        console.log(`... and ${testResults.errors.length - 5} more errors`);
      }
    }
    
    console.log('='.repeat(60));
  }
}

async function main() {
  const testType = process.argv[2] || 'burst';
  const runner = new StressTestRunner();
  
  try {
    let results;
    
    if (testType === 'concurrent') {
      results = await runner.runConcurrentPurchaseTest();
    } else if (testType === 'burst') {
      results = await runner.runBurstTest();
    } else {
      console.error('Invalid test type. Use "burst" or "concurrent"');
      process.exit(1);
    }
    
    runner.printResults(results);
    
    // Exit with error code if test failed
    const successRate = (results.testResults.successfulRequests / results.testResults.totalRequests) * 100;
    if (successRate < 95) {
      console.log('\n❌ Test failed - success rate below 95%');
      process.exit(1);
    } else {
      console.log('\n✅ Test passed - system performed well under stress');
    }
    
  } catch (error) {
    console.error('Stress test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = StressTestRunner;