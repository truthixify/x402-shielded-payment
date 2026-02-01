# Shielded Payment Client

A React TypeScript application that provides a user interface for interacting with the shielded payment system. The client enables users to deposit funds into the shielded pool, generate zero-knowledge proofs, and make private payments to x402-enabled servers.

## Overview

The client application serves as the primary interface for users to:

- Connect their Aptos wallet
- Deposit APT tokens into the shielded pool
- Generate shielded keypairs for privacy
- Create zero-knowledge proofs for transactions
- Make private payments to servers
- Monitor transaction status and UTXO balances

## Architecture

### Core Components

1. **Wallet Integration** - Connect to Aptos wallets (Petra, Martian, etc.)
2. **Shielded Keypair Management** - Generate and manage privacy keys
3. **UTXO Management** - Track and manage unspent transaction outputs
4. **Proof Generation** - Create zero-knowledge proofs using snarkjs
5. **Transaction Builder** - Construct and sign shielded transactions
6. **Pool Synchronization** - Sync with on-chain pool state

### Technology Stack

- **React 19** - Modern React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Aptos TypeScript SDK** - Blockchain interaction
- **snarkjs** - Zero-knowledge proof generation
- **circomlib** - Cryptographic primitives

## Features

### Wallet Connection

- Support for multiple Aptos wallets
- Automatic wallet detection
- Account balance display
- Network switching (testnet/mainnet)

### Shielded Operations

- **Deposit** - Add funds to shielded pool
- **Transfer** - Send private payments
- **Withdraw** - Extract funds from pool
- **Balance Check** - View shielded balance

### Privacy Features

- **Address Privacy** - Hide wallet addresses from servers
- **Payment Unlinkability** - Prevent transaction correlation
- **Memo Binding** - Cryptographically bind payments to requests
- **UTXO Management** - Efficient privacy-preserving balance tracking

## Installation

### Prerequisites

1. **Node.js** (v18 or later)
2. **npm** or **yarn**
3. **Modern web browser** with WebAssembly support
4. **Aptos wallet** (Petra, Martian, etc.)

### Setup

```bash
# Clone repository
git clone <repository-url>
cd client

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment
nano .env
```

### Environment Configuration

```bash
# Aptos Network Configuration
VITE_APTOS_NETWORK=testnet
VITE_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1

# Shielded Pool Configuration
VITE_POOL_ADDRESS=0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564

# Facilitator Configuration
VITE_FACILITATOR_URL=http://localhost:4023

# Circuit Configuration
VITE_CIRCUIT_WASM=/circuit.wasm
VITE_CIRCUIT_ZKEY=/circuit.zkey

# Development Configuration
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=info
```

## Development

### Development Server

```bash
# Start development server
npm run dev

# Start with specific port
npm run dev -- --port 3000

# Start with network access
npm run dev -- --host 0.0.0.0
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Build with analysis
npm run build -- --analyze
```

### Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

## Core Libraries

### Transaction Management (lib/transaction.ts)

Handles all transaction-related operations:

```typescript
import { TransactionBuilder } from './lib/transaction';

// Initialize transaction builder
const txBuilder = new TransactionBuilder(Network.TESTNET, poolAddress);

// Create deposit transaction
const depositTx = await txBuilder.createDepositTransaction(
  account,
  amount,
  outputUtxo
);

// Create payment transaction
const paymentTx = await txBuilder.createPaymentTransaction(
  account,
  inputUtxos,
  paymentAmount,
  recipientKey,
  changeUtxo,
  relayerAddress
);
```

### Proof Generation (lib/proof.ts)

Generates zero-knowledge proofs for transactions:

```typescript
import { ProofGenerator } from './lib/proof';

// Initialize proof generator
const prover = new ProofGenerator(merkleTreeHeight);

// Generate transaction proof
const { proof, publicSignals } = await prover.generateProof(
  transactionData,
  merkleTree
);

// Verify proof (optional)
const isValid = await prover.verifyProof(
  proof,
  publicSignals,
  verificationKey
);
```

### UTXO Management (lib/utxo.ts)

Manages unspent transaction outputs:

```typescript
import { Utxo } from './lib/utxo';

// Create new UTXO
const utxo = new Utxo({
  amount: BigInt('1000000'), // 0.01 APT
  keypair: shieldedKeypair,
  blinding: randomBN()
});

// Get commitment
const commitment = utxo.getCommitment();

// Encrypt for storage
const encrypted = await utxo.encrypt();

// Decrypt received UTXO
const decrypted = await Utxo.decrypt(keypair, encryptedData, index);
```

### Keypair Management (lib/keypair.ts)

Handles shielded cryptographic keys:

```typescript
import { Keypair } from './lib/keypair';

// Generate new keypair
const keypair = new Keypair();

// Import from private key
const imported = Keypair.fromString(privateKeyHex);

// Get public address
const address = keypair.address();

// Sign message
const signature = keypair.sign(message, index);

// Encrypt/decrypt data
const encrypted = await keypair.encrypt(data);
const decrypted = await keypair.decrypt(encrypted);
```

### Utilities (lib/utils.ts)

Common utility functions:

```typescript
import { poseidonHash, toFixedHex, randomBN } from './lib/utils';

// Hash values with Poseidon
const hash = poseidonHash([value1, value2]);

// Convert to fixed-length hex
const hex = toFixedHex(value, 32);

// Generate random big number
const random = randomBN();

// Initialize Poseidon (required before use)
await initPoseidon();
```

## User Interface

### Main Components

1. **App.tsx** - Main application component
2. **WalletConnection** - Wallet integration interface
3. **DepositForm** - Deposit funds to pool
4. **PaymentForm** - Make shielded payments
5. **UTXOList** - Display user's UTXOs
6. **TransactionHistory** - Show transaction history

### State Management

The application uses React hooks for state management:

```typescript
// Wallet state
const [account, setAccount] = useState<Account | null>(null);
const [balance, setBalance] = useState<string>('0');

// Shielded state
const [shieldedKeypair, setShieldedKeypair] = useState<Keypair | null>(null);
const [utxos, setUtxos] = useState<Utxo[]>([]);

// UI state
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Styling

The application uses Tailwind CSS for styling:

```css
/* Dark theme with modern design */
.bg-gray-900 { background-color: #111827; }
.text-white { color: #ffffff; }
.bg-blue-600 { background-color: #2563eb; }

/* Responsive design */
.container { max-width: 1200px; margin: 0 auto; }
.grid { display: grid; }
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.md:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

## Integration Guide

### Wallet Integration

The client supports multiple Aptos wallets:

```typescript
// Detect available wallets
const wallets = await window.aptos?.getWallets();

// Connect to wallet
const account = await window.aptos?.connect();

// Sign transaction
const signature = await window.aptos?.signTransaction(transaction);
```

### x402 Payment Flow

Integration with x402-enabled servers:

```typescript
// 1. Receive 402 Payment Required
const response = await fetch('/protected-resource');
if (response.status === 402) {
  const price = response.headers.get('X-Price');
  const recipient = response.headers.get('X-Payment-Recipient');
  const nonce = response.headers.get('X-Request-Nonce');
  
  // 2. Generate payment
  const payment = await generateShieldedPayment({
    amount: BigInt(price),
    recipient,
    memo: computeMemo(domain, path, nonce)
  });
  
  // 3. Broadcast transaction
  const txHash = await facilitator.broadcast(payment);
  
  // 4. Retry with payment proof
  const retryResponse = await fetch('/protected-resource', {
    headers: { 'X-Payment-Tx': txHash }
  });
}
```

### Circuit Integration

Loading and using ZK circuits:

```typescript
// Load circuit files
const wasmBuffer = await fetch('/circuit.wasm').then(r => r.arrayBuffer());
const zkeyBuffer = await fetch('/circuit.zkey').then(r => r.arrayBuffer());

// Generate proof
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  circuitInputs,
  new Uint8Array(wasmBuffer),
  new Uint8Array(zkeyBuffer)
);
```

## Security Considerations

### Private Key Management

- **Never expose private keys** in client-side code
- **Use secure storage** for shielded keypairs
- **Implement key rotation** for long-term security
- **Clear sensitive data** from memory after use

### Transaction Security

- **Validate all inputs** before proof generation
- **Verify proof validity** before submission
- **Use secure random numbers** for blinding factors
- **Implement replay protection** with nonces

### Network Security

- **Use HTTPS** for all communications
- **Validate server certificates** 
- **Implement CORS** properly
- **Sanitize user inputs**

## Performance Optimization

### Proof Generation

- **Web Workers** - Generate proofs in background threads
- **Caching** - Cache circuit files and verification keys
- **Batching** - Combine multiple operations when possible
- **Progressive Loading** - Load circuit files on demand

```typescript
// Use Web Worker for proof generation
const worker = new Worker('/proof-worker.js');
worker.postMessage({ circuitInputs, wasmBuffer, zkeyBuffer });
worker.onmessage = (event) => {
  const { proof, publicSignals } = event.data;
  // Handle proof result
};
```

### Memory Management

- **Cleanup** - Dispose of large objects after use
- **Streaming** - Process large datasets in chunks
- **Lazy Loading** - Load components and data on demand
- **Memoization** - Cache expensive computations

### Network Optimization

- **Request Batching** - Combine multiple API calls
- **Caching** - Cache pool state and transaction data
- **Compression** - Use gzip for large responses
- **CDN** - Serve static assets from CDN

## Testing

### Unit Tests

Test individual components and functions:

```typescript
import { render, screen } from '@testing-library/react';
import { Utxo } from '../lib/utxo';

describe('UTXO', () => {
  test('creates valid commitment', () => {
    const utxo = new Utxo({ amount: 1000n });
    const commitment = utxo.getCommitment();
    expect(commitment).toBeDefined();
    expect(typeof commitment).toBe('bigint');
  });
});
```

### Integration Tests

Test component interactions:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('App Integration', () => {
  test('deposit flow', async () => {
    render(<App />);
    
    // Connect wallet
    fireEvent.click(screen.getByText('Connect Wallet'));
    
    // Make deposit
    fireEvent.click(screen.getByText('Deposit 1 APT'));
    
    await waitFor(() => {
      expect(screen.getByText('Transaction submitted')).toBeInTheDocument();
    });
  });
});
```

### End-to-End Tests

Test complete user workflows:

```typescript
import { test, expect } from '@playwright/test';

test('complete payment flow', async ({ page }) => {
  await page.goto('/');
  
  // Connect wallet
  await page.click('text=Connect Wallet');
  
  // Deposit funds
  await page.click('text=Deposit 1 APT');
  await page.waitForSelector('text=Deposit successful');
  
  // Make payment
  await page.click('text=Pay 0.5 APT');
  await page.waitForSelector('text=Payment successful');
  
  // Verify UTXO update
  await expect(page.locator('.utxo-list')).toContainText('0.5 APT');
});
```

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Verify build
npm run preview
```

### Static Hosting

Deploy to static hosting services:

```bash
# Deploy to Netlify
npm install -g netlify-cli
netlify deploy --prod --dir dist

# Deploy to Vercel
npm install -g vercel
vercel --prod

# Deploy to GitHub Pages
npm run build
npm run deploy:gh-pages
```

### Docker Deployment

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment-Specific Builds

```bash
# Build for testnet
VITE_APTOS_NETWORK=testnet npm run build

# Build for mainnet
VITE_APTOS_NETWORK=mainnet npm run build

# Build with debugging
VITE_DEBUG_MODE=true npm run build
```

## Troubleshooting

### Common Issues

**Wallet Connection Fails:**
```typescript
// Check wallet availability
if (!window.aptos) {
  console.error('No Aptos wallet detected');
  // Show wallet installation instructions
}

// Handle connection errors
try {
  const account = await window.aptos.connect();
} catch (error) {
  console.error('Wallet connection failed:', error);
  // Show user-friendly error message
}
```

**Proof Generation Fails:**
```typescript
// Check circuit files
try {
  const wasmResponse = await fetch('/circuit.wasm');
  if (!wasmResponse.ok) {
    throw new Error('Circuit WASM file not found');
  }
} catch (error) {
  console.error('Circuit loading failed:', error);
}

// Validate inputs
if (!circuitInputs.root || circuitInputs.root === '0') {
  throw new Error('Invalid Merkle tree root');
}
```

**Transaction Submission Fails:**
```typescript
// Check network connection
try {
  const response = await aptos.getChainId();
  console.log('Connected to chain:', response);
} catch (error) {
  console.error('Network connection failed:', error);
}

// Validate transaction
try {
  const simulation = await aptos.simulateTransaction({
    transaction,
    signer: account
  });
  console.log('Transaction simulation:', simulation);
} catch (error) {
  console.error('Transaction validation failed:', error);
}
```

### Debug Tools

```typescript
// Enable debug logging
localStorage.setItem('debug', 'shielded:*');

// Inspect circuit inputs
console.log('Circuit inputs:', JSON.stringify(circuitInputs, null, 2));

// Monitor proof generation
const startTime = Date.now();
const proof = await generateProof(inputs);
console.log('Proof generation time:', Date.now() - startTime, 'ms');

// Validate UTXO state
utxos.forEach((utxo, index) => {
  console.log(`UTXO ${index}:`, {
    amount: utxo.amount.toString(),
    commitment: utxo.getCommitment().toString(16),
    nullifier: utxo.getNullifier().toString(16)
  });
});
```

## Contributing

### Development Guidelines

- **Code Style** - Follow TypeScript and React best practices
- **Testing** - Add tests for new components and functions
- **Documentation** - Update documentation for API changes
- **Security** - Consider security implications of changes

### Component Guidelines

```typescript
// Use functional components with hooks
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  return (
    <div className="component-container">
      {/* Component JSX */}
    </div>
  );
};

// Export with proper types
export default MyComponent;
export type { Props as MyComponentProps };
```

### Pull Request Process

1. **Fork repository** and create feature branch
2. **Implement changes** with proper testing
3. **Update documentation** as needed
4. **Run linting and tests** before submission
5. **Submit pull request** with clear description

## License

This project is licensed under the MIT License. See the LICENSE file for details.