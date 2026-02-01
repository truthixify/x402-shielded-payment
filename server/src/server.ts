import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import crypto from 'crypto';
import axios from 'axios';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(cors());

// Configuration
const PORT = process.env.PORT || 3000;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:4023';
const SERVER_SHIELDED_KEY = process.env.SERVER_SHIELDED_KEY;
const PREMIUM_CONTENT_PRICE = process.env.PREMIUM_CONTENT_PRICE || '50000000';
const APTOS_NETWORK = process.env.APTOS_NETWORK || 'testnet';
const SHIELDED_POOL_ADDRESS = process.env.SHIELDED_POOL_ADDRESS;

if (!SERVER_SHIELDED_KEY) {
  console.error('ERROR: SERVER_SHIELDED_KEY environment variable required');
  process.exit(1);
}

if (!SHIELDED_POOL_ADDRESS) {
  console.error('ERROR: SHIELDED_POOL_ADDRESS environment variable required');
  process.exit(1);
}

// Initialize Aptos client
const aptosConfig = new AptosConfig({ 
  network: APTOS_NETWORK === 'mainnet' ? Network.MAINNET : Network.TESTNET 
});
const aptos = new Aptos(aptosConfig);

console.log(`Server starting with configuration:`);
console.log(`- Network: ${APTOS_NETWORK}`);
console.log(`- Pool: ${SHIELDED_POOL_ADDRESS}`);
console.log(`- Facilitator: ${FACILITATOR_URL}`);
console.log(`- Shielded Key: ${SERVER_SHIELDED_KEY.slice(0, 20)}...`);

// In-memory storage for request nonces (in production, use Redis or database)
const requestNonces = new Map<string, { timestamp: number; used: boolean }>();

// Clean up old nonces every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [nonce, data] of requestNonces.entries()) {
    if (data.timestamp < oneHourAgo) {
      requestNonces.delete(nonce);
    }
  }
}, 60 * 60 * 1000);

// Generate a unique request nonce
function generateRequestNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Compute memo hash for request binding
function computeMemoHash(serverDomain: string, resourcePath: string, requestNonce: string): string {
  const memoString = `${serverDomain}${resourcePath}${requestNonce}`;
  const hash = crypto.createHash('sha256').update(memoString).digest('hex');
  
  // Convert to field element (mod BN254 scalar field)
  const BN254_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const hashBigInt = BigInt('0x' + hash);
  return (hashBigInt % BN254_FIELD).toString();
}

// Verify payment with facilitator
async function verifyPayment(
  paymentTx: string,
  expectedAmount: string,
  serverDomain: string,
  resourcePath: string,
  requestNonce: string
): Promise<{ isValid: boolean; reason?: string; payer?: string }> {
  try {
    const paymentPayload = {
      accepted: {
        scheme: 'shielded',
        network: `aptos:${APTOS_NETWORK === 'mainnet' ? '1' : '2'}`
      },
      payload: {
        transaction: paymentTx
      }
    };

    const paymentRequirements = {
      scheme: 'shielded',
      network: `aptos:${APTOS_NETWORK === 'mainnet' ? '1' : '2'}`,
      amount: expectedAmount,
      recipientShieldedKey: SERVER_SHIELDED_KEY,
      serverDomain,
      resourcePath,
      requestNonce
    };

    const response = await axios.post(`${FACILITATOR_URL}/verify`, {
      paymentPayload,
      paymentRequirements
    });

    return {
      isValid: response.data.isValid,
      reason: response.data.invalidReason,
      payer: response.data.payer
    };
  } catch (error) {
    console.error('Payment verification failed:', error);
    return {
      isValid: false,
      reason: 'verification_error'
    };
  }
}

// Settle payment with facilitator
async function settlePayment(
  paymentTx: string,
  expectedAmount: string,
  serverDomain: string,
  resourcePath: string,
  requestNonce: string
): Promise<{ success: boolean; transactionHash?: string; reason?: string }> {
  try {
    const paymentPayload = {
      accepted: {
        scheme: 'shielded',
        network: `aptos:${APTOS_NETWORK === 'mainnet' ? '1' : '2'}`
      },
      payload: {
        transaction: paymentTx
      }
    };

    const paymentRequirements = {
      scheme: 'shielded',
      network: `aptos:${APTOS_NETWORK === 'mainnet' ? '1' : '2'}`,
      amount: expectedAmount,
      recipientShieldedKey: SERVER_SHIELDED_KEY,
      serverDomain,
      resourcePath,
      requestNonce
    };

    const response = await axios.post(`${FACILITATOR_URL}/settle`, {
      paymentPayload,
      paymentRequirements
    });

    return {
      success: response.data.success,
      transactionHash: response.data.transaction,
      reason: response.data.errorReason
    };
  } catch (error) {
    console.error('Payment settlement failed:', error);
    return {
      success: false,
      reason: 'settlement_error'
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Public endpoint - no payment required
app.get('/', (req, res) => {
  res.json({
    message: 'x402 Shielded Payment Server',
    network: APTOS_NETWORK,
    shieldedPool: SHIELDED_POOL_ADDRESS,
    endpoints: {
      '/': 'This public endpoint',
      '/premium': 'Premium content (requires payment)',
      '/api/data': 'API endpoint (requires payment)'
    }
  });
});

// Premium content endpoint - requires payment
app.get('/premium', async (req, res) => {
  const paymentTx = req.headers['x-payment-tx'] as string;
  
  if (!paymentTx) {
    // No payment provided, return 402 Payment Required
    const requestNonce = generateRequestNonce();
    const serverDomain = req.get('host') || 'localhost:3000';
    const resourcePath = req.path;
    
    // Store nonce
    requestNonces.set(requestNonce, { timestamp: Date.now(), used: false });
    
    return res.status(402).json({
      error: 'Payment Required',
      scheme: 'shielded',
      network: `aptos:${APTOS_NETWORK === 'mainnet' ? '1' : '2'}`,
      amount: PREMIUM_CONTENT_PRICE,
      recipientShieldedKey: SERVER_SHIELDED_KEY,
      requestNonce,
      facilitatorUrl: FACILITATOR_URL,
      message: 'This premium content requires a shielded payment'
    });
  }

  // Extract request nonce from payment or headers
  const requestNonce = req.headers['x-request-nonce'] as string;
  if (!requestNonce) {
    return res.status(400).json({ error: 'Missing request nonce' });
  }

  // Check if nonce exists and hasn't been used
  const nonceData = requestNonces.get(requestNonce);
  if (!nonceData) {
    return res.status(400).json({ error: 'Invalid or expired request nonce' });
  }
  if (nonceData.used) {
    return res.status(400).json({ error: 'Request nonce already used' });
  }

  // Verify and settle payment
  const serverDomain = req.get('host') || 'localhost:3000';
  const resourcePath = req.path;
  
  const settlementResult = await settlePayment(
    paymentTx,
    PREMIUM_CONTENT_PRICE,
    serverDomain,
    resourcePath,
    requestNonce
  );

  if (!settlementResult.success) {
    return res.status(402).json({
      error: 'Payment verification failed',
      reason: settlementResult.reason
    });
  }

  // Mark nonce as used
  nonceData.used = true;

  // Payment successful, serve premium content
  res.json({
    message: '🎉 Welcome to premium content!',
    content: {
      title: 'Exclusive Data',
      data: 'This is premium content that requires payment to access.',
      timestamp: new Date().toISOString(),
      paymentTx: settlementResult.transactionHash
    }
  });
});

// API endpoint - requires payment
app.get('/api/data', async (req, res) => {
  const paymentTx = req.headers['x-payment-tx'] as string;
  
  if (!paymentTx) {
    const requestNonce = generateRequestNonce();
    const serverDomain = req.get('host') || 'localhost:3000';
    const resourcePath = req.path;
    
    requestNonces.set(requestNonce, { timestamp: Date.now(), used: false });
    
    return res.status(402).json({
      error: 'Payment Required',
      scheme: 'shielded',
      network: `aptos:${APTOS_NETWORK === 'mainnet' ? '1' : '2'}`,
      amount: PREMIUM_CONTENT_PRICE,
      recipientShieldedKey: SERVER_SHIELDED_KEY,
      requestNonce,
      facilitatorUrl: FACILITATOR_URL,
      message: 'This API endpoint requires a shielded payment'
    });
  }

  const requestNonce = req.headers['x-request-nonce'] as string;
  if (!requestNonce) {
    return res.status(400).json({ error: 'Missing request nonce' });
  }

  const nonceData = requestNonces.get(requestNonce);
  if (!nonceData || nonceData.used) {
    return res.status(400).json({ error: 'Invalid or used request nonce' });
  }

  const serverDomain = req.get('host') || 'localhost:3000';
  const resourcePath = req.path;
  
  const settlementResult = await settlePayment(
    paymentTx,
    PREMIUM_CONTENT_PRICE,
    serverDomain,
    resourcePath,
    requestNonce
  );

  if (!settlementResult.success) {
    return res.status(402).json({
      error: 'Payment verification failed',
      reason: settlementResult.reason
    });
  }

  nonceData.used = true;

  res.json({
    data: [
      { id: 1, name: 'Premium Dataset A', value: 42 },
      { id: 2, name: 'Premium Dataset B', value: 84 },
      { id: 3, name: 'Premium Dataset C', value: 126 }
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      paymentTx: settlementResult.transactionHash,
      cost: PREMIUM_CONTENT_PRICE
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    network: APTOS_NETWORK,
    shieldedPool: SHIELDED_POOL_ADDRESS,
    facilitator: FACILITATOR_URL
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║              x402 Shielded Payment Server                  ║
╠════════════════════════════════════════════════════════════╣
║  Network:     ${APTOS_NETWORK.padEnd(43)}║
║  Pool:        ${SHIELDED_POOL_ADDRESS.slice(0, 10)}...${SHIELDED_POOL_ADDRESS.slice(-8).padEnd(28)}║
║  Port:        ${String(PORT).padEnd(43)}║
║  Facilitator: ${FACILITATOR_URL.padEnd(43)}║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET  /           - Public info                          ║
║    GET  /premium    - Premium content (requires payment)   ║
║    GET  /api/data   - API endpoint (requires payment)      ║
║    GET  /health     - Health check                         ║
╚════════════════════════════════════════════════════════════╝
`);
});

export default app;