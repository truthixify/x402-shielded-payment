# Aptos x402 Shielded Payments

A complete implementation of x402 shielded payments on Aptos using zero-knowledge proofs for privacy-preserving transactions.

## Overview

This project enables **payer address privacy** for x402 payments while preserving existing HTTP 402 semantics. Users deposit funds into a shielded pool and make private payments to servers without revealing their wallet addresses.

## Architecture

- **Shielded Pool**: Zero-knowledge proof system for private transactions
- **x402 Integration**: Seamless integration with HTTP 402 Payment Required flow
- **Facilitator**: Relayer service for broadcasting shielded transactions

## Workspace Structure

```
├── contract/           # Move smart contracts for the shielded pool
├── circuits/           # ZK circuits for proof generation
├── client/             # React TypeScript client application
├── server/             # x402 payment server implementation
├── shielded-facilitator/  # HTTP facilitator service
└── package.json        # Workspace configuration
```

Each component has its own detailed README:

- **[contract/README.md](contract/README.md)** - Move smart contracts documentation
- **[circuits/README.md](circuits/README.md)** - Zero-knowledge circuits guide
- **[client/README.md](client/README.md)** - React client application guide
- **[server/README.md](server/README.md)** - x402 payment server documentation
- **[shielded-facilitator/README.md](shielded-facilitator/README.md)** - Facilitator service guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build contracts:**
   ```bash
   npm run build:contracts
   ```

3. **Test contracts:**
   ```bash
   npm run test:contracts
   ```

4. **Build circuits:**
   ```bash
   npm run build:circuits
   ```

5. **Start client:**
   ```bash
   npm run dev:client
   ```

6. **Start server:**
   ```bash
   npm run dev:server
   ```

7. **Start facilitator:**
   ```bash
   npm run start:facilitator
   ```

## Workspace Commands

- `npm run build:contracts` - Compile Move contracts
- `npm run test:contracts` - Run Move contract tests
- `npm run build:circuits` - Build ZK circuits
- `npm run dev:client` - Start React client in development mode
- `npm run build:client` - Build React client for production
- `npm run dev:server` - Start x402 server in development mode
- `npm run build:server` - Build x402 server for production
- `npm run start:facilitator` - Start the facilitator service
- `npm run dev:facilitator` - Start facilitator in development mode

## Privacy Properties

✅ **Payer address privacy** - Servers never learn user wallet addresses  
✅ **Payment unlinkability** - Payments cannot be linked across requests  
✅ **Deposit unlinkability** - Deposits cannot be linked to payments  
✅ **Request binding** - Payments are cryptographically bound to specific requests  

❌ **Amount privacy** - Payment amounts remain public  
❌ **Server privacy** - Server addresses remain public  
❌ **Network privacy** - No protection against timing/IP correlation  

## How It Works

1. **Pre-funding**: Users deposit APT into the shielded pool
2. **x402 Challenge**: Server responds with payment requirements including shielded address
3. **Proof Generation**: Client generates ZK proof for shielded transfer
4. **Facilitator Broadcast**: Facilitator verifies and broadcasts the transaction
5. **Settlement**: Shielded pool contract verifies proof and transfers funds
6. **Verification**: Server verifies on-chain settlement and serves content

## Integration

This system is fully compatible with existing x402 implementations. Servers only need to:

1. Generate a shielded receiving address
2. Include it in `402 Payment Required` responses  
3. Verify on-chain settlement instead of direct transfers

## Security

- **Trustless**: No trust required in facilitators or third parties
- **On-chain verification**: All proofs verified by smart contracts
- **Replay protection**: Cryptographic binding prevents payment reuse
- **Standard cryptography**: Uses well-established ZK-SNARK constructions

## License

MIT