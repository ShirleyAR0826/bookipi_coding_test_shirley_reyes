# ⚡ High-Performance Flash Sale Platform

A robust, scalable flash sale platform designed to handle thousands of concurrent users attempting to purchase limited stock items. Built with Node.js, Express, React, and Redis for optimal performance under high load.

## 🏗️ Architecture Overview

This system is designed to handle the classic "flash sale" problem where thousands of users attempt to purchase a limited quantity of items simultaneously. The architecture emphasizes:

- **High Concurrency**: Handles thousands of simultaneous requests
- **Data Consistency**: Prevents overselling through distributed locking and atomic operations
- **Fault Tolerance**: Graceful degradation and fallback mechanisms
- **Scalability**: Horizontal scaling with stateless design
- **Performance**: Sub-second response times under load

See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) for detailed architecture documentation.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Docker** (optional, for Redis)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd flash-sale-platform

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Redis (Optional but Recommended)

```bash
# Using Docker Compose (recommended)
docker-compose up redis

# Or install Redis locally
# Follow instructions at https://redis.io/download
```

### 3. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env file with your configuration
```

Key environment variables:
```bash
# Sale Configuration
SALE_START_TIME=2026-04-23T10:00:00Z
SALE_END_TIME=2026-04-23T12:00:00Z
TOTAL_STOCK=1000

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 4. Start the Application

```bash
# Terminal 1: Start backend server
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm start
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 📖 Usage Guide

### Flash Sale Interface

1. **Enter User ID**: Provide a unique identifier (email, username, etc.)
2. **Monitor Status**: Real-time updates show sale status, stock levels, and countdown
3. **Purchase**: Click "Buy Now" when the sale is active
4. **Confirmation**: Receive immediate feedback on purchase success/failure

### API Endpoints

#### Get Sale Status
```http
GET /api/flash-sale/status
```
Response:
```json
{
  "success": true,
  "data": {
    "status": "active",
    "startTime": "2026-04-23T10:00:00.000Z",
    "endTime": "2026-04-23T12:00:00.000Z",
    "currentStock": 856,
    "totalStock": 1000,
    "soldCount": 144,
    "product": {
      "id": "limited-edition-flash-sale",
      "name": "Limited Edition Flash Sale Item",
      "price": 99.99
    },
    "serverTime": "2026-04-23T10:30:00.000Z"
  }
}
```

#### Attempt Purchase
```http
POST /api/flash-sale/purchase
Content-Type: application/json

{
  "userId": "user@example.com"
}
```

#### Check User Purchase
```http
GET /api/flash-sale/purchase/{userId}
```

## 🧪 Testing

### Unit and Integration Tests

```bash
cd backend

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Stress Testing

#### Quick Burst Test (500 concurrent requests)
```bash
cd backend
npm run stress-test burst
```

#### Sustained Load Test (500 users over 30 seconds)
```bash
cd backend
npm run stress-test concurrent
```

#### Artillery Load Testing (Comprehensive)
```bash
cd backend

# Install Artillery globally
npm install -g artillery

# Run load test
artillery run stress-tests/artillery-config.yml
```

### Custom Stress Test Configuration

```bash
# Environment variables for stress testing
CONCURRENT_USERS=1000      # Number of concurrent users
TEST_DURATION_MS=60000     # Test duration in milliseconds
TEST_URL=http://localhost:3001  # Target server URL

# Run custom configuration
CONCURRENT_USERS=200 TEST_DURATION_MS=30000 npm run stress-test
```

### Expected Test Results

A well-performing system should achieve:

- **Success Rate**: >95% under normal load
- **Response Time**: <100ms P95, <500ms P99
- **Throughput**: >1000 requests/second
- **Data Integrity**: Zero overselling events
- **Error Handling**: Graceful degradation under extreme load

## 🏛️ System Design Decisions

### 1. Concurrency Control Strategy

**Problem**: Prevent overselling when thousands of users attempt to purchase simultaneously.

**Solution**: Multi-layered concurrency control:

```javascript
// 1. Distributed locking per user
const lockKey = `purchase:lock:${userId}`;
const lockValue = await acquireLock(lockKey, 5000);

// 2. Atomic stock operations using Redis Lua scripts
const luaScript = `
  local currentStock = redis.call('GET', stockKey)
  if tonumber(currentStock) <= 0 then
    return {0, 'sold-out'}
  end
  redis.call('DECR', stockKey)
  redis.call('SADD', purchaseSetKey, userId)
  return {1, 'success'}
`;
```

**Why This Works**:
- Prevents race conditions between purchase attempts
- Ensures atomic stock decrements
- Eliminates possibility of overselling
- Scales across multiple server instances

### 2. Caching Strategy

**Primary**: Redis for distributed caching and coordination
**Fallback**: In-memory storage for development/testing

**Benefits**:
- Sub-millisecond data access
- Distributed locking capabilities
- Atomic operations support
- High availability through clustering

### 3. Rate Limiting Approach

**Implementation**: Multiple layers of rate limiting
- IP-based: 10 requests/minute per IP
- User-based: Purchase attempt locking
- Server-level: Connection limits and timeouts

**Rationale**: Prevents abuse while allowing legitimate high-volume access

### 4. Error Handling Philosophy

**Fail Fast**: Quick validation and early error returns
**Graceful Degradation**: Continue operating with reduced functionality
**Clear Communication**: Specific error messages for different scenarios

## 🔧 Development Guide

### Project Structure

```
flash-sale-platform/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── controllers/        # HTTP request handlers
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Utility functions
│   │   └── app.js             # Express application setup
│   ├── tests/                 # Unit and integration tests
│   └── stress-tests/          # Load testing scripts
├── frontend/                  # React application
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/          # API client
│   │   └── App.js             # Main application
│   └── public/
├── docker-compose.yml         # Local Redis setup
└── README.md                  # This file
```

### Adding New Features

1. **Backend Changes**:
   ```bash
   # Add to service layer
   backend/src/services/flashSaleService.js
   
   # Add API endpoint
   backend/src/controllers/flashSaleController.js
   
   # Add tests
   backend/tests/feature.test.js
   ```

2. **Frontend Changes**:
   ```bash
   # Add component
   frontend/src/components/NewFeature.js
   
   # Update API service
   frontend/src/services/api.js
   ```

3. **Testing**:
   ```bash
   npm test                    # Unit tests
   npm run stress-test         # Load tests
   ```

### Environment Configuration

#### Development
```bash
NODE_ENV=development
REDIS_URL=redis://localhost:6379
SALE_START_TIME=2026-04-23T10:00:00Z
SALE_END_TIME=2026-04-23T12:00:00Z
TOTAL_STOCK=1000
```

#### Production
```bash
NODE_ENV=production
REDIS_URL=redis://prod-redis-cluster:6379
REDIS_PASSWORD=secure_password
RATE_LIMIT_MAX_REQUESTS=50
```

## 🚀 Deployment

### Development Deployment

```bash
# Using Docker Compose
docker-compose up

# Or manual setup
npm run dev  # Backend
npm start    # Frontend (separate terminal)
```

### Production Deployment

#### Option 1: Docker Containers

```dockerfile
# Dockerfile example
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t flash-sale-backend .
docker run -p 3001:3001 flash-sale-backend
```

#### Option 2: Cloud Platform (AWS/Azure/GCP)

1. **Application Servers**: Deploy to ECS, App Service, or Compute Engine
2. **Load Balancer**: ALB, Load Balancer, or Cloud Load Balancing
3. **Cache Layer**: ElastiCache, Redis Cache, or Memorystore
4. **Monitoring**: CloudWatch, Application Insights, or Stackdriver

#### Option 3: Kubernetes

```yaml
# k8s deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flash-sale-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: flash-sale-api
  template:
    metadata:
      labels:
        app: flash-sale-api
    spec:
      containers:
      - name: api
        image: flash-sale-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
```

### Performance Tuning

#### Backend Optimizations

```javascript
// Connection pooling
const redisOptions = {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true
};

// Compression middleware
app.use(compression());

// Keep-alive connections
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
```

#### Frontend Optimizations

```javascript
// Code splitting
const LazyComponent = React.lazy(() => import('./HeavyComponent'));

// Memoization
const MemoizedComponent = React.memo(ExpensiveComponent);

// Service worker for caching
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## 📊 Monitoring and Observability

### Key Metrics to Track

1. **Performance Metrics**:
   - Response time (P50, P95, P99)
   - Throughput (requests/second)
   - Error rate (4xx, 5xx responses)

2. **Business Metrics**:
   - Purchase success rate
   - Stock turnover rate
   - User engagement metrics

3. **System Metrics**:
   - CPU and memory usage
   - Redis connection count
   - Network I/O

### Alerting Setup

```javascript
// Example alerting rules (Prometheus/AlertManager)
rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: High error rate detected
      
  - alert: SlowResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
```

## 🐛 Troubleshooting

### Common Issues

#### Redis Connection Failures
```bash
# Check Redis status
redis-cli ping

# Check connection string
echo $REDIS_URL

# Restart Redis
docker-compose restart redis
```

#### High Memory Usage
```javascript
// Monitor memory usage
const used = process.memoryUsage();
console.log('Memory usage:', {
  rss: Math.round(used.rss / 1024 / 1024) + 'MB',
  heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB'
});
```

#### Rate Limiting Issues
```bash
# Check rate limit configuration
curl -I http://localhost:3001/api/flash-sale/status

# Response headers will show rate limit status:
# X-RateLimit-Limit: 10
# X-RateLimit-Remaining: 9
# X-RateLimit-Reset: 1640995200
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=flash-sale:* npm run dev

# Verbose API testing
curl -v http://localhost:3001/api/flash-sale/status
```

### Performance Analysis

```bash
# Profile Node.js application
node --prof app.js

# Generate flame graph
npm install -g clinic
clinic doctor -- node app.js
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Run the test suite: `npm test`
5. Run stress tests: `npm run stress-test`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Submit a pull request

### Code Style

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **Jest** for testing

```bash
# Lint code
npm run lint

# Format code
npm run format

# Pre-commit hooks (recommended)
npm install -g husky
husky install
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Redis** for providing excellent in-memory data store
- **Express.js** for the robust web framework
- **React** for the powerful frontend framework
- **Artillery.js** for comprehensive load testing capabilities

## 📞 Support

For questions, issues, or contributions:

1. **Issues**: Create a GitHub issue with detailed description
2. **Discussions**: Use GitHub Discussions for questions
3. **Security**: Email security issues privately to maintainers

---

**Built with ⚡ for high-performance flash sales**