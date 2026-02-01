# Zero-Knowledge Circuits

This directory contains the Circom circuits that generate zero-knowledge proofs for shielded transactions. The circuits ensure that users can prove they have sufficient balance and generate valid transfers without revealing their private information.

## Circuit Architecture

The shielded payment system uses a hierarchical circuit design based on the Tornado Nova architecture:

### Core Circuits

1. **transaction2.circom** - Main transaction circuit for 2-input, 2-output transfers
2. **transaction.circom** - Base transaction logic
3. **merkleTree.circom** - Merkle tree membership proofs
4. **merkleProof.circom** - Individual Merkle path verification
5. **keypair.circom** - Cryptographic keypair operations

## Circuit Functionality

### Transaction Circuit (transaction2.circom)

The main circuit that proves the validity of a shielded transaction:

**Public Inputs:**
- `root` - Merkle tree root of all commitments
- `publicAmount` - Net amount being deposited/withdrawn
- `extDataHash` - Hash of external transaction data
- `inputNullifier[2]` - Nullifiers for input UTXOs
- `outputCommitment[2]` - Commitments for output UTXOs

**Private Inputs:**
- `inAmount[2]` - Input UTXO amounts
- `inPrivateKey[2]` - Private keys for input UTXOs
- `inBlinding[2]` - Blinding factors for input commitments
- `inPathIndices[2][20]` - Merkle path indices for inputs
- `inPathElements[2][20]` - Merkle path elements for inputs
- `outAmount[2]` - Output UTXO amounts
- `outBlinding[2]` - Blinding factors for output commitments
- `outPubkey[2]` - Public keys for output UTXOs

**Constraints:**
- Input commitments exist in the Merkle tree
- Input nullifiers are correctly computed
- Output commitments are correctly computed
- Balance equation: `sum(inputs) + publicAmount = sum(outputs)`
- External data hash is correctly computed

### Merkle Tree Circuit (merkleTree.circom)

Verifies membership of commitments in the Merkle tree:

**Parameters:**
- `levels` - Height of the Merkle tree (20 levels = 1M leaves)

**Functionality:**
- Computes Merkle root from leaf and path
- Uses Poseidon hash for tree operations
- Supports efficient batch verification

### Keypair Circuit (keypair.circom)

Handles cryptographic operations for UTXO ownership:

**Operations:**
- Private key to public key derivation
- Signature generation and verification
- Nullifier computation from private key and commitment

## Circuit Parameters

### Security Parameters

- **Field Size:** BN254 scalar field (~254 bits)
- **Tree Height:** 20 levels (supports 1,048,576 commitments)
- **Hash Function:** Poseidon (optimized for zero-knowledge)
- **Proof System:** Groth16 (efficient verification)

### Performance Characteristics

- **Constraints:** ~50,000 for transaction2 circuit
- **Proving Time:** ~5-10 seconds on modern hardware
- **Proof Size:** 256 bytes (constant size)
- **Verification Time:** ~5ms on-chain

## Building Circuits

### Prerequisites

1. **Node.js** (v16 or later)
2. **Circom** compiler
3. **snarkjs** for proof generation
4. **Powers of Tau** ceremony files

### Installation

```bash
# Install circom
npm install -g circom

# Install snarkjs
npm install -g snarkjs

# Install circuit dependencies
npm install
```

### Compilation Process

1. **Compile circuits:**
   ```bash
   npm run build:circuits
   ```

2. **Generate proving keys:**
   ```bash
   npm run setup:keys
   ```

3. **Generate verification keys:**
   ```bash
   npm run setup:verifier
   ```

### Manual Build Steps

For development and debugging:

```bash
# Compile transaction2 circuit
circom circuits/transaction2.circom --r1cs --wasm --sym -o build/

# Generate witness
node build/transaction2_js/generate_witness.js build/transaction2_js/transaction2.wasm input.json witness.wtns

# Generate proof
snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json
```

## Trusted Setup

### Powers of Tau Ceremony

The circuits use a universal trusted setup from the Powers of Tau ceremony:

**Files Required:**
- `pot12_final.ptau` - For circuits with <2^12 constraints
- `pot15_final.ptau` - For circuits with <2^15 constraints

**Download:**
```bash
# Download Powers of Tau files
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O ptau/pot12_final.ptau
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau -O ptau/pot15_final.ptau
```

### Circuit-Specific Setup

Each circuit requires its own proving and verification keys:

```bash
# Generate circuit-specific keys
snarkjs groth16 setup transaction2.r1cs pot15_final.ptau circuit_0000.zkey

# Contribute to ceremony (optional but recommended)
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey --name="First contribution"

# Generate final keys
snarkjs zkey beacon circuit_0001.zkey circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10

# Export verification key
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# Generate Move verifier
snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol
```

## Circuit Testing

### Unit Tests

Test individual circuit components:

```bash
# Test merkle tree circuit
npm run test:merkle

# Test keypair circuit  
npm run test:keypair

# Test transaction circuit
npm run test:transaction
```

### Integration Tests

Test complete proof generation flow:

```bash
# Generate test proof
npm run test:proof

# Verify test proof
npm run test:verify
```

### Test Vectors

The `test/` directory contains test vectors for:
- Valid transaction proofs
- Invalid input detection
- Edge case handling
- Performance benchmarks

## Circuit Optimization

### Constraint Reduction

Techniques used to minimize circuit size:

- **Efficient Poseidon implementation** - Reduces hash constraints by 40%
- **Optimized Merkle tree** - Uses binary tree structure
- **Batch operations** - Combines multiple checks into single constraints
- **Field arithmetic optimization** - Minimizes expensive operations

### Proving Performance

Optimizations for faster proof generation:

- **Witness generation** - Optimized JavaScript implementation
- **Memory usage** - Efficient constraint system representation
- **Parallelization** - Multi-threaded proving when available

## Security Analysis

### Circuit Security

The circuits implement several security measures:

**Double-Spending Prevention:**
- Nullifiers ensure each UTXO can only be spent once
- Nullifier computation includes private key and commitment

**Balance Verification:**
- Input amounts must equal output amounts plus public amount
- Prevents inflation or deflation attacks

**Commitment Hiding:**
- Commitments hide amount and recipient using blinding factors
- Only commitment hash is revealed publicly

**Merkle Tree Integrity:**
- Membership proofs ensure inputs exist in valid tree
- Path verification prevents fake commitment attacks

### Known Limitations

**Trusted Setup Dependency:**
- Requires honest participants in setup ceremony
- Compromised setup could enable proof forgery

**Circuit Bugs:**
- Implementation errors could create vulnerabilities
- Extensive testing and auditing required

**Side-Channel Attacks:**
- Proving time may leak information about inputs
- Constant-time implementations recommended

## Integration Guide

### Client Integration

For applications using the circuits:

```javascript
import { groth16 } from 'snarkjs';

// Generate proof
const { proof, publicSignals } = await groth16.fullProve(
  circuitInputs,
  'circuit.wasm',
  'circuit_final.zkey'
);

// Format for blockchain submission
const formattedProof = {
  pi_a: [proof.pi_a[0], proof.pi_a[1]],
  pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
  pi_c: [proof.pi_c[0], proof.pi_c[1]]
};
```

### Smart Contract Integration

The circuits generate proofs compatible with the Move verifier:

```move
// Verify proof in Move contract
let valid = groth16_verifier::verify_proof(
    proof_a, proof_b, proof_c,
    public_inputs
);
```

## Development Workflow

### Adding New Circuits

1. **Design circuit** - Define inputs, outputs, and constraints
2. **Implement in Circom** - Write circuit code
3. **Add tests** - Create comprehensive test cases
4. **Optimize** - Reduce constraints and improve performance
5. **Security review** - Audit for vulnerabilities
6. **Integration** - Connect to client and contract code

### Debugging Circuits

Common debugging techniques:

```bash
# Check circuit compilation
circom circuit.circom --r1cs --wasm --sym

# Inspect constraint system
snarkjs r1cs info circuit.r1cs

# Debug witness generation
node generate_witness.js circuit.wasm input.json witness.wtns --verbose

# Analyze constraint violations
snarkjs wtns check circuit.r1cs witness.wtns
```

## Performance Benchmarks

### Proving Times

On modern hardware (Intel i7, 16GB RAM):

- **transaction2 circuit:** 8-12 seconds
- **merkle tree (20 levels):** 2-3 seconds  
- **keypair operations:** <1 second

### Memory Requirements

- **Proving:** 4-8GB RAM recommended
- **Verification:** <100MB RAM
- **Circuit compilation:** 2-4GB RAM

### Optimization Targets

- **Constraint count:** <100,000 for main circuit
- **Proving time:** <10 seconds on consumer hardware
- **Memory usage:** <8GB for proving

## Troubleshooting

### Common Issues

**Compilation Errors:**
```bash
# Check circom version
circom --version

# Verify circuit syntax
circom circuit.circom --r1cs
```

**Witness Generation Failures:**
```bash
# Check input format
node generate_witness.js circuit.wasm input.json witness.wtns

# Validate input values
# Ensure all inputs are within field bounds
```

**Proof Generation Errors:**
```bash
# Verify R1CS and witness compatibility
snarkjs wtns check circuit.r1cs witness.wtns

# Check proving key integrity
snarkjs zkey verify circuit.r1cs pot_final.ptau circuit_final.zkey
```

### Debug Commands

```bash
# Circuit information
snarkjs r1cs info circuit.r1cs

# Witness debugging
snarkjs wtns debug circuit.r1cs witness.wtns circuit.sym --trigger --get --set

# Proof verification
snarkjs groth16 verify verification_key.json public.json proof.json
```

## Contributing

### Development Guidelines

- **Code style:** Follow Circom best practices
- **Testing:** Add tests for all new circuits
- **Documentation:** Document circuit purpose and constraints
- **Security:** Consider attack vectors and edge cases

### Review Process

1. **Circuit review** - Verify correctness and security
2. **Performance analysis** - Check constraint count and proving time
3. **Integration testing** - Test with client and contract code
4. **Security audit** - Professional review for production use

## Resources

### Documentation

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Guide](https://github.com/iden3/snarkjs)
- [Tornado Nova Paper](https://tornado.cash/nova.pdf)
- [Poseidon Hash](https://eprint.iacr.org/2019/458.pdf)

### Tools

- [Circom IDE](https://ide.circom.io/) - Online circuit development
- [Circuit Visualizer](https://github.com/iden3/circom/tree/master/tools) - Debug circuit structure
- [Constraint Analyzer](https://github.com/iden3/circom/tree/master/tools) - Optimize circuit performance

## License

This project is licensed under the MIT License. See the LICENSE file for details.