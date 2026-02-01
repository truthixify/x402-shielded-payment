# x402 Payment Server

A TypeScript server implementation that demonstrates x402 (HTTP 402 Payment Required) integration with the shielded payment system. This server provides protected endpoints that require shielded payments for access, showcasing how to integrate privacy-preserving payments into web services.

## Overview

The x402 Payment Server demonstrates how to:

- Implement HTTP 402 Payment Required responses
- Integrate with the shielded payment system
- Verify on-chain payment settlement
- Bind payments to specific requests
- Provide protected content after payment verification

This server serves as both a reference implementation and a testing platform for the shielded payment system.

## Architecture

### Core Components

1. **HTTP Server** - Express.js server with x402 middleware
2. **Payment Verification** - On-chain payment validation
3. **Request Binding** - Cryptographic binding of payments to requests
4. **Content Protection** - Access control for premium endpoints
5. **Blockchain Integration** - Aptos SDK for on-chain verification

### x402 Flow Implementation

1. **Request** - Client requests protected resource
2. **Challenge** - Server responds with 402 Payment Required
3. **Payment** - Client generates and submits shielded payment
4. **Verification** - Server verifies on-chain settlement
5. **Access** - Server provides protected content

## Features

### Payment Integration

- **Shielded Payment Support** - Accept privacy-preserving payments
- **Request Binding** - Prevent payment replay and reuse
- **Flexible Pricing** - Support for variable payment amounts
- **Multiple Endpoints** - Different prices for different resources

### Security Features

- **Cryptographic Binding** - Payments tied to specific requests
- **Replay Protection** - Prevent payment reuse across requests
- **On-chain Verification** - Trustless payment validation
- **Rate Limiting** - Prevent abuse and DoS attacks

### Developer Features

- **TypeScript** - Full type safety and IDE support
- **Modular Design** - Easy to integrate into existing applications
- **Comprehensive Logging** - Detailed request and payment logging
- **Health Monitoring** - Built-in health check endpoints

## Installation

### Prerequisites

1. **Node.js** (v18 or later)
2. **npm** or **yarn**
3. **Access to Aptos network** (testnet or mainnet)
4. **Shielded pool contract** deployed and accessible

### Setup

```bash
# Clone repository
git clone <repository-url>
cd server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment
nano .env
```

### Environment Configuration

```bash
# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Aptos Configuration
APTOS_NETWORK=testnet
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1

# Shielded Pool Configuration
POOL_ADDRESS=0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564

# Server Shielded Keys
SERVER_SHIELDED_PRIVATE_KEY=0x1234567890abcdef...
SERVER_SHIELDED_PUBLIC_KEY=0xabcdef1234567890...

# Payment Configuration
DEFAULT_PRICE=1000000  # 0.01 APT in octas
PREMIUM_PRICE=5000000  # 0.05 APT in octas

# Security Configuration
CORS_ORIGINS=http://localhost:3000,https://yourapp.com
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
```

## API Endpoints

### Protected Endpoints

#### GET /api/data

Basic protected endpoint requiring payment.

**Without Payment:**
```http
GET /api/data
```

**Response (402 Payment Required):**
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Price: 1000000
X-Payment-Contract: 0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564
X-Payment-Recipient: 0xabcdef1234567890...
X-Request-Nonce: 1234567890abcdef

{
  "error": "Payment Required",
  "message": "This endpoint requires payment to access",
  "price": "1000000",
  "currency": "APT",
  "paymentContract": "0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564",
  "recipient": "0xabcdef1234567890...",
  "nonce": "1234567890abcdef"
}
```

**With Payment:**
```http
GET /api/data
X-Payment-Tx: 0x1234567890abcdef...
```

**Response (200 OK):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": "This is the protected data you paid for",
  "timestamp": "2024-01-01T12:00:00Z",
  "paymentVerified": true,
  "transactionHash": "0x1234567890abcdef..."
}
```

#### GET /premium

Premium endpoint with higher pricing.

**Payment Required Response:**
```json
{
  "error": "Payment Required",
  "message": "Premium content requires higher payment",
  "price": "5000000",
  "currency": "APT",
  "paymentContract": "0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564",
  "recipient": "0xabcdef1234567890...",
  "nonce": "abcdef1234567890"
}
```

**Successful Response:**
```json
{
  "premiumData": {
    "insights": ["Advanced insight 1", "Advanced insight 2"],
    "analytics": {
      "metric1": 42,
      "metric2": 3.14
    }
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "paymentVerified": true
}
```

### Utility Endpoints

#### GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "blockchain": {
    "connected": true,
    "network": "testnet",
    "latestBlock": 12345678
  },
  "shieldedPool": {
    "address": "0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564",
    "accessible": true
  }
}
```

#### GET /info

Server information and configuration.

**Response:**
```json
{
  "name": "x402 Payment Server",
  "version": "1.0.0",
  "network": "testnet",
  "endpoints": [
    {
      "path": "/api/data",
      "price": "1000000",
      "currency": "APT",
      "description": "Basic protected data"
    },
    {
      "path": "/premium",
      "price": "5000000", 
      "currency": "APT",
      "description": "Premium analytics data"
    }
  ],
  "paymentContract": "0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564",
  "serverPublicKey": "0xabcdef1234567890..."
}
```

## Payment Verification

### Verification Process

The server verifies payments through multiple steps:

1. **Transaction Existence** - Verify transaction exists on blockchain
2. **Contract Interaction** - Confirm transaction called pool contract
3. **Event Validation** - Check for correct transfer events
4. **Amount Verification** - Ensure payment amount matches price
5. **Recipient Verification** - Confirm payment sent to server's key
6. **Memo Validation** - Verify request-specific memo binding

### Verification Implementation

```typescript
class PaymentVerifier {
  async verifyPayment(
    transactionHash: string,
    expectedAmount: bigint,
    expectedMemo: string,
    nonce: string
  ): Promise<boolean> {
    // 1. Get transaction from blockchain
    const transaction = await this.aptos.getTransactionByHash({
      transactionHash
    });
    
    // 2. Verify transaction success
    if (!transaction.success) {
      throw new Error('Transaction failed');
    }
    
    // 3. Verify contract interaction
    const poolCall = transaction.payload.function === 
      `${this.poolAddress}::pool::transact`;
    if (!poolCall) {
      throw new Error('Transaction did not call pool contract');
    }
    
    // 4. Verify events
    const events = transaction.events.filter(
      event => event.type.includes('NewCommitment')
    );
    
    // 5. Validate payment parameters
    return this.validatePaymentEvents(
      events,
      expectedAmount,
      expectedMemo,
      nonce
    );
  }
}
```

### Memo Binding

Payments are cryptographically bound to specific requests:

```typescript
function computeMemo(
  serverDomain: string,
  resourcePath: string,
  requestNonce: string
): string {
  const message = `${serverDomain}${resourcePath}${requestNonce}`;
  return sha3_256(message);
}

// Example usage
const memo = computeMemo(
  'api.example.com',
  '/api/data',
  '1234567890abcdef'
);
```

## Development

### Development Server

```bash
# Start development server
npm run dev

# Start with debugging
npm run dev:debug

# Start with specific port
PORT=3001 npm run dev
```

### Building

```bash
# Build for production
npm run build

# Build and start
npm run build && npm start

# Build with type checking
npm run build:check
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- payment.test.ts
```

## Integration Examples

### Client Integration

Example of how clients can integrate with the x402 server:

```typescript
class X402Client {
  constructor(private baseUrl: string) {}
  
  async requestWithPayment(endpoint: string): Promise<any> {
    // 1. Initial request
    let response = await fetch(`${this.baseUrl}${endpoint}`);
    
    if (response.status === 402) {
      // 2. Handle payment required
      const paymentInfo = await response.json();
      const price = paymentInfo.price;
      const recipient = paymentInfo.recipient;
      const nonce = paymentInfo.nonce;
      
      // 3. Generate shielded payment
      const memo = this.computeMemo(endpoint, nonce);
      const payment = await this.generateShieldedPayment({
        amount: BigInt(price),
        recipient,
        memo
      });
      
      // 4. Submit payment
      const txHash = await this.submitPayment(payment);
      
      // 5. Retry with payment proof
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-Payment-Tx': txHash
        }
      });
    }
    
    return response.json();
  }
  
  private computeMemo(endpoint: string, nonce: string): string {
    const domain = new URL(this.baseUrl).hostname;
    return sha3_256(`${domain}${endpoint}${nonce}`);
  }
}
```

### Express Middleware

The server uses Express middleware for x402 integration:

```typescript
import { x402Middleware } from './middleware/x402';

const app = express();

// Apply x402 middleware to protected routes
app.use('/api/data', x402Middleware({
  price: BigInt('1000000'),
  description: 'Basic protected data'
}));

app.use('/premium', x402Middleware({
  price: BigInt('5000000'),
  description: 'Premium analytics data'
}));

// Route handlers
app.get('/api/data', (req, res) => {
  // This only executes after payment verification
  res.json({
    data: 'Protected content',
    paymentVerified: true
  });
});
```

### Custom Pricing

Implement dynamic pricing based on request parameters:

```typescript
app.use('/api/query', x402Middleware({
  priceCalculator: (req) => {
    const complexity = req.query.complexity || 'basic';
    const basePrices = {
      basic: BigInt('1000000'),    // 0.01 APT
      advanced: BigInt('5000000'), // 0.05 APT
      premium: BigInt('10000000')  // 0.1 APT
    };
    return basePrices[complexity] || basePrices.basic;
  },
  description: 'Query API with variable pricing'
}));
```

## Security Considerations

### Payment Security

- **On-chain Verification** - All payments verified on blockchain
- **Memo Binding** - Prevents payment replay across requests
- **Nonce Protection** - Each request gets unique nonce
- **Amount Validation** - Exact payment amount required

### Server Security

- **Input Validation** - Sanitize all user inputs
- **Rate Limiting** - Prevent abuse and DoS attacks
- **CORS Configuration** - Restrict cross-origin requests
- **HTTPS Only** - Encrypt all communications

### Key Management

- **Private Key Security** - Secure storage of shielded private keys
- **Key Rotation** - Regular rotation of server keys
- **Environment Variables** - Never hardcode sensitive data
- **Access Control** - Limit server access

## Monitoring and Logging

### Logging Configuration

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' })
  ]
});
```

### Metrics Collection

Key metrics to monitor:

- **Request Rate** - Requests per second/minute
- **Payment Success Rate** - Percentage of successful payments
- **Response Time** - Average response time per endpoint
- **Error Rate** - Failed requests percentage
- **Revenue** - Total payments received

### Health Monitoring

```typescript
// Health check implementation
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    blockchain: await checkBlockchainConnection(),
    shieldedPool: await checkPoolAccess()
  };
  
  res.json(health);
});
```

## Deployment

### Production Configuration

```bash
# Production environment variables
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Use mainnet for production
APTOS_NETWORK=mainnet
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1

# Production pool address
POOL_ADDRESS=0x...

# Secure server keys
SERVER_SHIELDED_PRIVATE_KEY=0x...
SERVER_SHIELDED_PUBLIC_KEY=0x...

# Production security settings
CORS_ORIGINS=https://yourapp.com
RATE_LIMIT_MAX=50
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start server
CMD ["npm", "start"]
```

### Process Management

```bash
# Using PM2 for production
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart x402-server
```

### Load Balancing

```nginx
upstream x402_servers {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name api.example.com;
    
    location / {
        proxy_pass http://x402_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Testing

### Unit Tests

```typescript
import request from 'supertest';
import app from '../src/server';

describe('x402 Payment Server', () => {
  test('returns 402 for protected endpoint', async () => {
    const response = await request(app)
      .get('/api/data')
      .expect(402);
      
    expect(response.body.error).toBe('Payment Required');
    expect(response.body.price).toBeDefined();
    expect(response.headers['x-price']).toBeDefined();
  });
  
  test('accepts valid payment', async () => {
    const txHash = '0x1234567890abcdef...';
    
    const response = await request(app)
      .get('/api/data')
      .set('X-Payment-Tx', txHash)
      .expect(200);
      
    expect(response.body.paymentVerified).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Payment Integration', () => {
  test('complete payment flow', async () => {
    // 1. Request protected resource
    const initialResponse = await request(app)
      .get('/api/data')
      .expect(402);
    
    const { price, recipient, nonce } = initialResponse.body;
    
    // 2. Generate and submit payment
    const payment = await generateTestPayment({
      amount: BigInt(price),
      recipient,
      memo: computeMemo('/api/data', nonce)
    });
    
    const txHash = await submitTestTransaction(payment);
    
    // 3. Retry with payment proof
    const finalResponse = await request(app)
      .get('/api/data')
      .set('X-Payment-Tx', txHash)
      .expect(200);
    
    expect(finalResponse.body.paymentVerified).toBe(true);
  });
});
```

## Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check port availability
netstat -tulpn | grep 3001

# Check environment variables
npm run config:check

# Check dependencies
npm audit
```

**Payment verification fails:**
```bash
# Check blockchain connection
curl https://fullnode.testnet.aptoslabs.com/v1/

# Verify pool contract
aptos account list --query resources --account <pool-address>

# Check server keys
echo $SERVER_SHIELDED_PUBLIC_KEY
```

**High error rates:**
```bash
# Check server logs
tail -f server.log

# Monitor system resources
top
df -h

# Check network connectivity
ping fullnode.testnet.aptoslabs.com
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set debug environment
DEBUG=x402:* npm run dev

# Or set log level
LOG_LEVEL=debug npm run dev
```

## Contributing

### Development Guidelines

- **TypeScript** - Use strict type checking
- **Testing** - Add tests for new features
- **Documentation** - Update API documentation
- **Security** - Consider security implications

### Code Style

```typescript
// Use async/await for asynchronous operations
async function verifyPayment(txHash: string): Promise<boolean> {
  try {
    const transaction = await aptos.getTransactionByHash({ transactionHash: txHash });
    return validateTransaction(transaction);
  } catch (error) {
    logger.error('Payment verification failed', { txHash, error });
    return false;
  }
}

// Use proper error handling
class PaymentError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PaymentError';
  }
}
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.