/**
 * x402 Shielded Facilitator for Aptos
 *
 * Supports shielded payments using Shielded Pool-style ZK proofs.
 * Users deposit into a shielded pool and make private payments to servers.
 *
 * Endpoints:
 *   POST /verify  - Verify a shielded payment without executing
 *   POST /settle  - Submit shielded transaction on-chain
 *   GET /supported - List supported networks/schemes
 */

import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import crypto from 'crypto';
import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
  AccountAddress,
  Deserializer,
  SimpleTransaction,
  AccountAuthenticator
} from '@aptos-labs/ts-sdk';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Configuration
const PORT = process.env.PORT || 4023;
const APTOS_PRIVATE_KEY = process.env.APTOS_PRIVATE_KEY;
const SHIELDED_POOL_ADDRESS = process.env.SHIELDED_POOL_ADDRESS;
const NETWORK = 'aptos:2'; // testnet

if (!APTOS_PRIVATE_KEY) {
  console.error('ERROR: APTOS_PRIVATE_KEY environment variable required');
  process.exit(1);
}

if (!SHIELDED_POOL_ADDRESS) {
  console.error('ERROR: SHIELDED_POOL_ADDRESS environment variable required');
  process.exit(1);
}

// Initialize facilitator account (relayer)
const privateKeyHex = APTOS_PRIVATE_KEY.startsWith('0x') ? APTOS_PRIVATE_KEY.slice(2) : APTOS_PRIVATE_KEY;
const privateKey = new Ed25519PrivateKey(privateKeyHex);
const relayerAccount = Account.fromPrivateKey({ privateKey });

// Aptos client
const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

console.log(`Relayer Account: ${relayerAccount.accountAddress.toStringLong()}`);
console.log(`Shielded Pool: ${SHIELDED_POOL_ADDRESS}`);

// Pretty print helper
function logJson(label, obj) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🛡️  ${label}`);
  console.log('─'.repeat(60));
  console.log(JSON.stringify(obj, null, 2));
  console.log('─'.repeat(60) + '\n');
}

/**
 * Deserialize the Aptos shielded payment from the payload
 */
function deserializeShieldedPayment(transactionBase64) {
  const decoded = Buffer.from(transactionBase64, 'base64').toString('utf8');
  const parsed = JSON.parse(decoded);

  const transactionBytes = Uint8Array.from(parsed.transaction);
  const transaction = SimpleTransaction.deserialize(new Deserializer(transactionBytes));

  const authBytes = Uint8Array.from(parsed.senderAuthenticator);
  const senderAuthenticator = AccountAuthenticator.deserialize(new Deserializer(authBytes));

  // Extract entry function if present
  let entryFunction = null;
  if (transaction.rawTransaction.payload && 'entryFunction' in transaction.rawTransaction.payload) {
    entryFunction = transaction.rawTransaction.payload.entryFunction;
  }

  return { transaction, senderAuthenticator, entryFunction };
}

/**
 * Extract shielded payment parameters from pool::transact call
 */
function extractShieldedParams(entryFunction) {
  const args = entryFunction.args;
  
  // pool::transact has many parameters - extract the key ones
  // Based on our Move contract signature (without pool_address parameter):
  // transact(user, proof_a_x, proof_a_y, ..., recipient, ext_amount, relayer, fee, ...)
  
  if (args.length < 19) { // Minimum expected args for shielded transaction (reduced by 1 since no pool_address)
    throw new Error('Insufficient arguments for shielded transaction');
  }

  // Extract external data parameters (these are at the end of the args list)
  const recipient = args[args.length - 6]; // recipient address
  const extAmount = args[args.length - 5]; // ext_amount (u256)
  const relayer = args[args.length - 4];   // relayer address
  const fee = args[args.length - 3];       // fee (u64)
  const encryptedOutput1 = args[args.length - 2]; // encrypted_output1
  const encryptedOutput2 = args[args.length - 1]; // encrypted_output2

  // Extract proof parameters and public inputs
  const extDataHash = args[args.length - 7]; // ext_data_hash
  const publicAmount = args[args.length - 8]; // public_amount
  
  return {
    recipient,
    extAmount,
    relayer,
    fee,
    encryptedOutput1,
    encryptedOutput2,
    extDataHash,
    publicAmount
  };
}

/**
 * Compute expected external data hash for memo binding verification
 */
function computeExpectedMemoHash(serverDomain, resourcePath, requestNonce) {
  const memoString = `${serverDomain}${resourcePath}${requestNonce}`;
  const hash = crypto.createHash('sha256').update(memoString).digest();
  
  // Convert to field element (mod BN254 scalar field)
  const BN254_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const hashBigInt = BigInt('0x' + hash.toString('hex'));
  return (hashBigInt % BN254_FIELD).toString();
}

/**
 * Verify a shielded payment payload against requirements
 */
async function verifyShieldedPayment(paymentPayload, paymentRequirements) {
  try {
    const shieldedPayload = paymentPayload.payload;

    // Check scheme
    if (paymentPayload.accepted.scheme !== 'shielded' || paymentRequirements.scheme !== 'shielded') {
      return { isValid: false, invalidReason: 'unsupported_scheme', payer: '' };
    }

    // Check network
    if (paymentPayload.accepted.network !== paymentRequirements.network) {
      return { isValid: false, invalidReason: 'network_mismatch', payer: '' };
    }

    // Deserialize transaction
    const { transaction, senderAuthenticator, entryFunction } = deserializeShieldedPayment(shieldedPayload.transaction);
    const senderAddress = transaction.rawTransaction.sender.toString();

    // Must have entry function
    if (!entryFunction) {
      return { isValid: false, invalidReason: 'invalid_payment_missing_entry_function', payer: senderAddress };
    }

    // Verify it's calling shielded_pool::pool::transact
    const moduleAddress = entryFunction.module_name.address.toString();
    const moduleName = entryFunction.module_name.name.identifier;
    const functionName = entryFunction.function_name.identifier;

    const expectedPoolAddress = AccountAddress.from(SHIELDED_POOL_ADDRESS).toString();
    if (moduleAddress !== expectedPoolAddress || moduleName !== 'pool' || functionName !== 'transact') {
      return { isValid: false, invalidReason: 'invalid_payment_wrong_function', payer: senderAddress };
    }

    // Extract shielded payment parameters
    let shieldedParams;
    try {
      shieldedParams = extractShieldedParams(entryFunction);
    } catch (error) {
      return { isValid: false, invalidReason: `invalid_payment_params: ${error.message}`, payer: senderAddress };
    }

    // Verify recipient matches server's shielded public key
    const recipientBytes = new Deserializer(shieldedParams.recipient.bcsToBytes()).deserializeBytes();
    const recipientHex = '0x' + Buffer.from(recipientBytes).toString('hex');
    if (recipientHex !== paymentRequirements.recipientShieldedKey) {
      return { isValid: false, invalidReason: 'invalid_payment_recipient_mismatch', payer: senderAddress };
    }

    // Verify relayer is this facilitator
    const relayerAddress = AccountAddress.from(shieldedParams.relayer.bcsToBytes());
    if (!relayerAddress.equals(relayerAccount.accountAddress)) {
      return { isValid: false, invalidReason: 'invalid_payment_relayer_mismatch', payer: senderAddress };
    }

    // Verify amount (encoded in ext_amount as field element)
    const extAmountBytes = new Deserializer(shieldedParams.extAmount.bcsToBytes()).deserializeU256();
    const BN254_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    const actualAmount = extAmountBytes < BN254_FIELD / 2n ? extAmountBytes : BN254_FIELD - extAmountBytes;
    
    if (actualAmount.toString() !== paymentRequirements.amount) {
      return { isValid: false, invalidReason: 'invalid_payment_amount_mismatch', payer: senderAddress };
    }

    // Verify memo binding (ext_data_hash should bind to request)
    if (paymentRequirements.serverDomain && paymentRequirements.resourcePath && paymentRequirements.requestNonce) {
      const expectedMemoHash = computeExpectedMemoHash(
        paymentRequirements.serverDomain,
        paymentRequirements.resourcePath,
        paymentRequirements.requestNonce
      );
      
      const actualMemoHash = new Deserializer(shieldedParams.extDataHash.bcsToBytes()).deserializeU256().toString();
      
      if (actualMemoHash !== expectedMemoHash) {
        return { isValid: false, invalidReason: 'invalid_payment_memo_binding', payer: senderAddress };
      }
    }

    // Simulate transaction to verify it would succeed
    try {
      let publicKey;
      if (senderAuthenticator.isEd25519()) {
        publicKey = senderAuthenticator.public_key;
      } else if (senderAuthenticator.isSingleKey()) {
        publicKey = senderAuthenticator.public_key;
      } else if (senderAuthenticator.isMultiKey()) {
        publicKey = senderAuthenticator.public_keys;
      }

      const simulationResult = (await aptos.transaction.simulate.simple({
        signerPublicKey: publicKey,
        transaction
      }))[0];

      if (!simulationResult.success) {
        return { isValid: false, invalidReason: `simulation_failed: ${simulationResult.vm_status}`, payer: senderAddress };
      }
    } catch (error) {
      return { isValid: false, invalidReason: `simulation_error: ${error.message}`, payer: senderAddress };
    }

    return { isValid: true, payer: senderAddress };

  } catch (error) {
    console.error('Verify error:', error);
    return { isValid: false, invalidReason: 'unexpected_verify_error', payer: '' };
  }
}

/**
 * Settle a shielded payment by submitting the transaction on-chain
 */
async function settleShieldedPayment(paymentPayload, paymentRequirements) {
  // First verify
  const verifyResult = await verifyShieldedPayment(paymentPayload, paymentRequirements);
  if (!verifyResult.isValid) {
    return {
      success: false,
      network: paymentPayload.accepted.network,
      transaction: '',
      errorReason: verifyResult.invalidReason || 'verification_failed',
      payer: verifyResult.payer || ''
    };
  }

  try {
    const { transaction, senderAuthenticator } = deserializeShieldedPayment(paymentPayload.payload.transaction);
    const senderAddress = transaction.rawTransaction.sender.toStringLong();

    // For shielded payments, we always act as a relayer (fee payer)
    // Set fee payer address and sign as fee payer
    transaction.feePayerAddress = relayerAccount.accountAddress;

    const feePayerAuthenticator = aptos.transaction.signAsFeePayer({
      signer: relayerAccount,
      transaction
    });

    const pendingTxn = await aptos.transaction.submit.simple({
      transaction,
      senderAuthenticator,
      feePayerAuthenticator
    });

    // Wait for transaction
    await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

    return {
      success: true,
      transaction: pendingTxn.hash,
      network: paymentPayload.accepted.network,
      payer: senderAddress
    };

  } catch (error) {
    console.error('Settle error:', error);
    return {
      success: false,
      errorReason: `transaction_failed: ${error.message}`,
      transaction: '',
      network: paymentPayload.accepted.network,
      payer: verifyResult.payer || ''
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /verify
 * Verify a shielded payment without executing
 */
app.post('/verify', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({ isValid: false, invalidReason: 'missing_parameters' });
    }

    logJson('SHIELDED VERIFY REQUEST', { paymentPayload, paymentRequirements });

    const result = await verifyShieldedPayment(paymentPayload, paymentRequirements);

    logJson('SHIELDED VERIFY RESPONSE', result);

    res.json(result);
  } catch (error) {
    console.error('Verify endpoint error:', error);
    res.status(500).json({ isValid: false, invalidReason: error.message });
  }
});

/**
 * POST /settle
 * Submit the shielded transaction on-chain
 */
app.post('/settle', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({ success: false, errorReason: 'missing_parameters' });
    }

    logJson('SHIELDED SETTLE REQUEST', { paymentPayload, paymentRequirements });

    const result = await settleShieldedPayment(paymentPayload, paymentRequirements);

    logJson('SHIELDED SETTLE RESPONSE', result);

    res.json(result);
  } catch (error) {
    console.error('Settle endpoint error:', error);
    res.status(500).json({ success: false, errorReason: error.message });
  }
});

/**
 * GET /supported
 * Return supported networks and schemes
 */
app.get('/supported', (req, res) => {
  res.json({
    kinds: [
      {
        x402Version: 2,
        scheme: 'shielded',
        network: NETWORK,
        extra: { 
          shieldedPool: SHIELDED_POOL_ADDRESS,
          relayer: relayerAccount.accountAddress.toStringLong()
        }
      }
    ],
    signers: {
      [NETWORK]: relayerAccount.accountAddress.toStringLong()
    }
  });
});

/**
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    network: NETWORK,
    relayer: relayerAccount.accountAddress.toStringLong(),
    shieldedPool: SHIELDED_POOL_ADDRESS
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         x402 Shielded Aptos Facilitator                    ║
╠════════════════════════════════════════════════════════════╣
║  Network:     ${NETWORK.padEnd(43)}║
║  Relayer:     ${relayerAccount.accountAddress.toString().slice(0, 10)}...${relayerAccount.accountAddress.toString().slice(-8).padEnd(28)}║
║  Pool:        ${SHIELDED_POOL_ADDRESS.slice(0, 10)}...${SHIELDED_POOL_ADDRESS.slice(-8).padEnd(28)}║
║  Port:        ${String(PORT).padEnd(43)}║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    POST /verify     - Verify shielded payment              ║
║    POST /settle     - Submit shielded transaction          ║
║    GET  /supported  - List supported schemes               ║
║    GET  /health     - Health check                         ║
╚════════════════════════════════════════════════════════════╝
`);
});