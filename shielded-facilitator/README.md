# Shielded Facilitator Service

The Shielded Facilitator is a relayer service that broadcasts pre-signed shielded transactions to the Aptos blockchain. It acts as an intermediary between clients and the blockchain, providing transaction broadcasting services while maintaining the trustless nature of the shielded payment system.

## Overview

The facilitator serves as a transaction broadcaster that:

- Receives pre-signed shielded transactions from clients
- Validates transaction format and structure
- Broadcasts transactions to the Aptos network
- Provides transaction status and confirmation
- Maintains no ability to modify or forge transactions

**Important:** The facilitator cannot steal funds, modify transactions, or break privacy guarantees. It only provides a broadcasting service for convenience and improved user experience.

## Architecture

### Core Components

1. **Transaction Receiver** - HTTP endpoint for receiving signed transactions
2. **Validation Engine** - Validates transaction format and parameters
3. **Blockchain Interface** - Submits transactions to Aptos network
4. **Status Tracker** - Monitors transaction confirmation status
5. **Event Monitor** - Watches for pool contract events

### Security Model

The facilitator operates under a **trustless security model**:

- **Cannot forge transactions** - All transactions are pre-signed by users
- **Cannot modify amounts** - Transaction contents are cryptographically sealed
- **Cannot break privacy** - No access to private keys or sensitive data
- **Cannot steal funds** - Only broadcasts user-authorized transactions

## API Endpoints

### POST /api/broadcast

Broadcasts a pre-signed shielded transaction to the blockchain.

**Request:**
```json
{
  "transaction": "base64-encoded-signed-transaction",
  "metadata": {
    "expectedAmount": "1000000",
    "recipientKey": "0x1234...",
    "memo": "request-specific-memo-hash"
  }
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0xabcd1234...",
  "status": "pending",
  "estimatedConfirmation": "2024-01-01T12:00:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "INVALID_TRANSACTION",
  "message": "Transaction signature verification failed",
  "code": 400
}
```

### GET /api/status/:txHash

Retrieves the current status of a broadcasted transaction.

**Response:**
```json
{
  "transactionHash": "0xabcd1234...",
  "status": "confirmed",
  "blockHeight": 12345678,
  "confirmations": 10,
  "gasUsed": 5000,
  "events": [
    {
      "type": "NewCommitment",
      "data": {
        "commitment": "0x5678...",
        "index": 42
      }
    }
  ]
}
```

### GET /api/pool/info

Returns current pool state information.

**Response:**
```json
{
  "poolAddress": "0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564",
  "currentRoot": "0x789abc...",
  "totalCommitments": 1337,
  "totalNullifiers": 420,
  "lastUpdate": "2024-01-01T12:00:00Z"
}
```

### GET /api/health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "blockchain": {
    "connected": true,
    "latestBlock": 12345678,
    "syncStatus": "synced"
  }
}
```

## Configuration

### Environment Variables

The facilitator is configured through environment variables:

```bash
# Server Configuration
PORT=4023
HOST=0.0.0.0
NODE_ENV=production

# Aptos Configuration
APTOS_NETWORK=testnet
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
APTOS_FAUCET_URL=https://faucet.testnet.aptoslabs.com

# Pool Configuration
POOL_ADDRESS=0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564

# Facilitator Account (for gas fees)
FACILITATOR_PRIVATE_KEY=0x1234567890abcdef...
FACILITATOR_ADDRESS=0xfacilitator...

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=60
MAX_TRANSACTIONS_PER_HOUR=100

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# Security
CORS_ORIGINS=https://yourapp.com,https://localhost:3000
API_KEY_REQUIRED=false
```

### Configuration File

Alternative configuration via `config.json`:

```json
{
  "server": {
    "port": 4023,
    "host": "0.0.0.0",
    "cors": {
      "origins": ["https://yourapp.com"]
    }
  },
  "aptos": {
    "network": "testnet",
    "nodeUrl": "https://fullnode.testnet.aptoslabs.com/v1",
    "poolAddress": "0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564"
  },
  "facilitator": {
    "privateKey": "0x...",
    "gasLimit": 10000,
    "maxRetries": 3
  },
  "rateLimit": {
    "requestsPerMinute": 60,
    "transactionsPerHour": 100
  }
}
```

## Installation and Setup

### Prerequisites

1. **Node.js** (v18 or later)
2. **npm** or **yarn**
3. **Aptos account** with APT for gas fees
4. **Access to Aptos network** (testnet or mainnet)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd shielded-facilitator

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### Account Setup

1. **Generate facilitator account:**
   ```bash
   aptos init --network testnet
   ```

2. **Fund account:**
   ```bash
   aptos account fund-with-faucet --account default
   ```

3. **Export private key:**
   ```bash
   aptos config show-private-key --account default
   ```

4. **Update .env file** with private key and address

### Development Setup

```bash
# Install development dependencies
npm install --dev

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## Running the Service

### Production Mode

```bash
# Start the service
npm start

# With PM2 (recommended)
npm install -g pm2
pm2 start ecosystem.config.js
```

### Development Mode

```bash
# Start with hot reload
npm run dev

# Start with debugging
npm run debug
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 4023

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t shielded-facilitator .
docker run -p 4023:4023 --env-file .env shielded-facilitator
```

## Transaction Validation

### Validation Pipeline

The facilitator validates transactions through multiple stages:

1. **Format Validation**
   - Verify transaction structure
   - Check required fields
   - Validate data types

2. **Signature Verification**
   - Verify transaction signature
   - Confirm signer authorization
   - Check signature format

3. **Pool Compatibility**
   - Verify target pool address
   - Check function call format
   - Validate parameter types

4. **Business Logic**
   - Verify reasonable amounts
   - Check rate limits
   - Validate memo format

### Validation Rules

```javascript
const validationRules = {
  transaction: {
    required: ['sender', 'payload', 'signature'],
    maxSize: 10000, // bytes
    timeout: 30000  // ms
  },
  amount: {
    min: 1,         // minimum 1 octa
    max: 1000000000000, // maximum 10,000 APT
  },
  memo: {
    format: /^[0-9a-fA-F]{64}$/, // 32-byte hex
    required: true
  }
};
```

## Monitoring and Logging

### Logging Configuration

The service uses structured logging with multiple levels:

```javascript
const logger = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  transports: [
    'console',
    'file'
  ],
  fields: [
    'timestamp',
    'level',
    'message',
    'transactionHash',
    'userAgent',
    'ip'
  ]
};
```

### Metrics Collection

Key metrics tracked:

- **Transaction throughput** - Transactions per second/minute/hour
- **Success rate** - Percentage of successful broadcasts
- **Response time** - API endpoint response times
- **Error rate** - Failed transaction percentage
- **Gas usage** - Average gas consumption per transaction

### Health Monitoring

```bash
# Check service health
curl http://localhost:4023/api/health

# Monitor transaction status
curl http://localhost:4023/api/status/0x1234...

# View pool information
curl http://localhost:4023/api/pool/info
```

## Error Handling

### Error Categories

1. **Client Errors (4xx)**
   - Invalid transaction format
   - Missing required fields
   - Rate limit exceeded
   - Unauthorized access

2. **Server Errors (5xx)**
   - Blockchain connection failure
   - Internal processing error
   - Database unavailable
   - Service overloaded

3. **Blockchain Errors**
   - Transaction rejected
   - Insufficient gas
   - Network congestion
   - Invalid proof

### Error Response Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {
    "field": "specific field that caused error",
    "value": "invalid value",
    "expected": "expected format or value"
  },
  "code": 400,
  "timestamp": "2024-01-01T12:00:00Z",
  "requestId": "req_1234567890"
}
```

## Security Considerations

### Input Validation

- **Sanitize all inputs** - Prevent injection attacks
- **Validate transaction format** - Ensure proper structure
- **Check signature validity** - Verify cryptographic signatures
- **Rate limiting** - Prevent abuse and DoS attacks

### Network Security

- **HTTPS only** - Encrypt all communications
- **CORS configuration** - Restrict cross-origin requests
- **API authentication** - Optional API key protection
- **Request logging** - Monitor for suspicious activity

### Operational Security

- **Private key protection** - Secure key storage and rotation
- **Access control** - Limit server access
- **Regular updates** - Keep dependencies current
- **Monitoring** - Alert on unusual activity

## Performance Optimization

### Caching Strategy

```javascript
const cache = {
  poolState: {
    ttl: 30000,    // 30 seconds
    maxSize: 1000
  },
  transactionStatus: {
    ttl: 60000,    // 1 minute
    maxSize: 10000
  }
};
```

### Connection Pooling

```javascript
const aptosConfig = {
  maxConnections: 10,
  connectionTimeout: 5000,
  requestTimeout: 30000,
  retryAttempts: 3
};
```

### Load Balancing

For high-traffic deployments:

```nginx
upstream facilitator {
    server facilitator1:4023;
    server facilitator2:4023;
    server facilitator3:4023;
}

server {
    listen 80;
    location / {
        proxy_pass http://facilitator;
    }
}
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "transaction validation"

# Run with coverage
npm run test:coverage
```

### Integration Tests

```bash
# Test against testnet
npm run test:integration

# Test transaction broadcasting
npm run test:broadcast

# Test error handling
npm run test:errors
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## Deployment Guide

### Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Monitoring setup
- [ ] Backup procedures in place
- [ ] Log rotation configured
- [ ] Health checks enabled

### Scaling Considerations

- **Horizontal scaling** - Multiple facilitator instances
- **Load balancing** - Distribute requests across instances
- **Database scaling** - Separate read/write operations
- **Caching layer** - Redis for shared state
- **CDN integration** - Cache static responses

### Maintenance

```bash
# Update dependencies
npm update

# Restart service
pm2 restart facilitator

# View logs
pm2 logs facilitator

# Monitor performance
pm2 monit
```

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check configuration
npm run config:validate

# Check port availability
netstat -tulpn | grep 4023

# Check logs
tail -f logs/facilitator.log
```

**Transaction failures:**
```bash
# Check Aptos connection
curl https://fullnode.testnet.aptoslabs.com/v1/

# Verify account balance
aptos account list --query balance --account <facilitator-address>

# Check pool contract
aptos account list --query resources --account <pool-address>
```

**High error rates:**
```bash
# Check system resources
top
df -h

# Monitor network
netstat -i

# Review error logs
grep ERROR logs/facilitator.log
```

## API Client Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

class FacilitatorClient {
  constructor(private baseUrl: string) {}

  async broadcastTransaction(signedTx: string, metadata: any) {
    const response = await axios.post(`${this.baseUrl}/api/broadcast`, {
      transaction: signedTx,
      metadata
    });
    return response.data;
  }

  async getTransactionStatus(txHash: string) {
    const response = await axios.get(`${this.baseUrl}/api/status/${txHash}`);
    return response.data;
  }
}

// Usage
const client = new FacilitatorClient('https://facilitator.example.com');
const result = await client.broadcastTransaction(signedTransaction, metadata);
```

### Python

```python
import requests

class FacilitatorClient:
    def __init__(self, base_url):
        self.base_url = base_url
    
    def broadcast_transaction(self, signed_tx, metadata):
        response = requests.post(f"{self.base_url}/api/broadcast", json={
            "transaction": signed_tx,
            "metadata": metadata
        })
        return response.json()
    
    def get_transaction_status(self, tx_hash):
        response = requests.get(f"{self.base_url}/api/status/{tx_hash}")
        return response.json()

# Usage
client = FacilitatorClient("https://facilitator.example.com")
result = client.broadcast_transaction(signed_transaction, metadata)
```

## Contributing

### Development Guidelines

- **Code style** - Follow ESLint configuration
- **Testing** - Add tests for new features
- **Documentation** - Update API documentation
- **Security** - Consider security implications

### Pull Request Process

1. **Fork repository**
2. **Create feature branch**
3. **Add tests** for new functionality
4. **Update documentation**
5. **Submit pull request**

## License

This project is licensed under the MIT License. See the LICENSE file for details.