# Shielded Pool Smart Contracts

This directory contains the Move smart contracts that implement the shielded pool system for private payments on Aptos. The contracts enable users to deposit funds privately and make shielded transfers without revealing their wallet addresses.

## Architecture Overview

The shielded pool system consists of four main Move modules:

### Core Modules

1. **pool.move** - Main shielded pool contract with deposit/transfer logic
2. **merkle_tree.move** - Merkle tree implementation for commitment tracking
3. **poseidon.move** - Poseidon hash function for zero-knowledge circuits
4. **groth16_verifier.move** - Groth16 proof verification for transactions

## Contract Functionality

### Shielded Pool (pool.move)

The main contract that manages the shielded pool operations:

**Key Features:**
- Deposit APT tokens into the shielded pool
- Execute shielded transfers with zero-knowledge proofs
- Maintain commitment and nullifier sets
- Emit events for client synchronization

**Public Functions:**
- `transact()` - Execute a shielded transaction with ZK proof
- `is_spent()` - Check if a nullifier has been used
- `get_current_root()` - Get the current Merkle tree root
- `configure_limits()` - Configure pool limits (admin only)

**Events:**
- `NewCommitment` - Emitted when new commitments are added
- `NewNullifier` - Emitted when nullifiers are spent

### Merkle Tree (merkle_tree.move)

Manages the Merkle tree of commitments for efficient proof generation:

**Key Features:**
- Insert new commitments into the tree
- Maintain tree structure with Poseidon hashing
- Support for tree height of 20 levels
- Efficient root calculation

**Public Functions:**
- `insert()` - Add a new commitment to the tree
- `get_root()` - Calculate and return the current root
- `get_commitment()` - Retrieve a commitment by index

### Poseidon Hash (poseidon.move)

Production-grade Poseidon hash implementation using Aptos crypto_algebra:

**Key Features:**
- Poseidon hash for 2, 3, and 4 inputs
- Optimized for zero-knowledge circuits
- Uses BN254 scalar field arithmetic
- Compatible with circomlib implementations

**Public Functions:**
- `poseidon2()` - Hash 2 field elements
- `poseidon3()` - Hash 3 field elements  
- `poseidon4()` - Hash 4 field elements

### Groth16 Verifier (groth16_verifier.move)

Verifies Groth16 zero-knowledge proofs for shielded transactions:

**Key Features:**
- Verify transaction proofs on-chain
- Support for BN254 elliptic curve
- Efficient pairing-based verification
- Compatible with snarkjs proof format

**Public Functions:**
- `verify_proof()` - Verify a Groth16 proof with public inputs

## Deployment

### Prerequisites

1. **Aptos CLI** - Install from [Aptos documentation](https://aptos.dev/tools/aptos-cli/)
2. **Move compiler** - Included with Aptos CLI
3. **Funded account** - Account with APT for deployment

### Configuration

The deployment configuration is in `Move.toml`:

```toml
[package]
name = "shielded_pool"
version = "1.0.0"
authors = ["Your Name <your.email@example.com>"]

[addresses]
shielded_pool = "_"

[dev-addresses]
shielded_pool = "0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564"

[dependencies.AptosFramework]
git = "https://github.com/aptos-labs/aptos-core.git"
rev = "mainnet"
subdir = "aptos-move/framework/aptos-framework"
```

### Deploy to Testnet

1. **Initialize account:**
   ```bash
   aptos init --network testnet
   ```

2. **Fund account:**
   ```bash
   aptos account fund-with-faucet --account default
   ```

3. **Compile contracts:**
   ```bash
   aptos move compile
   ```

4. **Deploy contracts:**
   ```bash
   aptos move publish --named-addresses shielded_pool=default
   ```

5. **Verify deployment:**
   ```bash
   aptos account list --query modules --account default
   ```

### Deploy to Mainnet

1. **Switch to mainnet:**
   ```bash
   aptos init --network mainnet
   ```

2. **Fund account** (with real APT)

3. **Deploy:**
   ```bash
   aptos move publish --named-addresses shielded_pool=default
   ```

## Testing

### Run Unit Tests

```bash
aptos move test
```

### Test Coverage

The test suite covers:
- Deposit functionality
- Shielded transfer execution
- Proof verification
- Merkle tree operations
- Error conditions and edge cases

### Test Files

- `sources/tests/pool_tests.move` - Comprehensive pool functionality tests

## Usage Examples

### Deposit to Pool

```move
use shielded_pool::pool;

public entry fun deposit_example(account: &signer) {
    // This is handled automatically when calling transact()
    // with a positive external amount
}
```

### Execute Shielded Transfer

```move
use shielded_pool::pool;

public entry fun transfer_example(
    account: &signer,
    // Groth16 proof components
    proof_a_x: u256, proof_a_y: u256,
    proof_b_x1: u256, proof_b_y1: u256,
    proof_b_x2: u256, proof_b_y2: u256,
    proof_c_x: u256, proof_c_y: u256,
    // Public inputs
    root: u256,
    input_nullifiers: vector<u256>,
    output_commitments: vector<u256>,
    public_amount: u256,
    ext_data_hash: u256,
    // External data
    recipient: address,
    ext_amount: u256,
    relayer: address,
    fee: u64,
    encrypted_output1: String,
    encrypted_output2: String,
) {
    pool::transact(
        account,
        proof_a_x, proof_a_y,
        proof_b_x1, proof_b_y1,
        proof_b_x2, proof_b_y2,
        proof_c_x, proof_c_y,
        root,
        input_nullifiers,
        output_commitments,
        public_amount,
        ext_data_hash,
        recipient,
        ext_amount,
        relayer,
        fee,
        encrypted_output1,
        encrypted_output2,
    );
}
```

## Security Considerations

### Proof Verification

- All zero-knowledge proofs are verified on-chain
- Invalid proofs cause transaction failure
- No trust required in off-chain components

### Nullifier Protection

- Nullifiers prevent double-spending
- Each UTXO can only be spent once
- Nullifier uniqueness enforced by contract

### Commitment Privacy

- Commitments hide amount and recipient
- Only commitment hash is stored on-chain
- Private keys required to spend commitments

### External Data Binding

- External data hash prevents replay attacks
- Cryptographically binds payments to requests
- Memo field ensures request-specific payments

## Gas Optimization

### Efficient Operations

- Merkle tree operations optimized for gas
- Poseidon hash uses native crypto operations
- Proof verification leverages Aptos crypto primitives

### Batch Operations

- Multiple commitments can be processed together
- Efficient tree updates minimize gas costs
- Optimized storage layout reduces read/write costs

## Integration Guide

### For dApp Developers

1. **Import the modules:**
   ```move
   use shielded_pool::pool;
   use shielded_pool::merkle_tree;
   ```

2. **Check pool state:**
   ```move
   let root = pool::get_current_root();
   let is_spent = pool::is_spent(nullifier);
   ```

3. **Listen for events:**
   ```typescript
   // Monitor NewCommitment events for deposits
   // Monitor NewNullifier events for spends
   ```

### For Client Applications

1. **Query pool state** via view functions
2. **Build Merkle tree** from commitment events
3. **Generate proofs** using circuit parameters
4. **Submit transactions** with valid proofs

## Troubleshooting

### Common Issues

**Compilation Errors:**
- Ensure Aptos CLI is up to date
- Check Move.toml configuration
- Verify dependency versions

**Deployment Failures:**
- Confirm account has sufficient APT
- Check network connectivity
- Verify account permissions

**Test Failures:**
- Run tests in clean environment
- Check for conflicting dependencies
- Verify test data integrity

### Debug Commands

```bash
# Check compilation
aptos move compile --dev

# Run specific test
aptos move test --filter test_deposit

# Check account resources
aptos account list --query resources --account <address>
```

## Performance Metrics

### Transaction Costs

- Deposit: ~1,000 gas units
- Shielded transfer: ~5,000 gas units
- Proof verification: ~3,000 gas units

### Storage Requirements

- Per commitment: 32 bytes
- Per nullifier: 32 bytes
- Merkle tree: ~1KB per 1000 commitments

## Upgrade Path

### Contract Upgrades

The contracts support upgrades through the Aptos upgrade mechanism:

1. **Prepare upgrade package**
2. **Submit upgrade proposal**
3. **Execute after governance approval**

### Migration Considerations

- Preserve existing commitments and nullifiers
- Maintain Merkle tree integrity
- Ensure backward compatibility

## Contributing

### Development Setup

1. **Clone repository**
2. **Install Aptos CLI**
3. **Run tests** to verify setup

### Code Standards

- Follow Move coding conventions
- Add comprehensive tests for new features
- Document public functions
- Use descriptive variable names

### Pull Request Process

1. **Fork repository**
2. **Create feature branch**
3. **Add tests** for new functionality
4. **Submit pull request** with description

## License

This project is licensed under the MIT License. See the LICENSE file for details.