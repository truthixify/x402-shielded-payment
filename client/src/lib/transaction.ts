import {
  Account,
  Aptos,
  AptosConfig,
  Network,
  SimpleTransaction,
  AccountAuthenticator,
  AccountAddress,
  U256,
  MoveVector,
  MoveString,
  Serializer
} from '@aptos-labs/ts-sdk';
import FixedMerkleTree from 'fixed-merkle-tree';
import { ProofGenerator, type TransactionData } from './proof';
import { Utxo } from './utxo';
import { toFixedHex, poseidonHash } from './utils';

const MERKLE_TREE_HEIGHT = 20;

// Poseidon hash function for 2 inputs (matching reference)
function poseidonHash2(a: bigint, b: bigint): bigint {
  return BigInt(poseidonHash([a, b]));
}

export interface ShieldedTransactionParams {
  inputs: Utxo[];
  outputs: Utxo[];
  recipient: string;
  extAmount: bigint;
  relayer: string;
  fee: bigint;
}

export class TransactionBuilder {
  private aptos: Aptos;
  private proofGenerator: ProofGenerator;
  private poolAddress: string;

  constructor(network: Network, poolAddress: string) {
    const config = new AptosConfig({ network });
    this.aptos = new Aptos(config);
    this.proofGenerator = new ProofGenerator(MERKLE_TREE_HEIGHT);
    this.poolAddress = poolAddress;
  }

  // Build merkle tree from on-chain commitments (exactly like reference)
  async buildMerkleTree(): Promise<FixedMerkleTree> {
    try {
      // Query NewCommitment events from the pool contract (like reference)
      const events = await this.aptos.getAccountEventsByEventType({
        accountAddress: this.poolAddress,
        eventType: `${this.poolAddress}::pool::NewCommitment`
      });

      // Sort events by index and extract commitments (exactly like reference)
      const leaves = events
        .sort((a: any, b: any) => a.data.index - b.data.index)
        .map((e: any) => toFixedHex(e.data.commitment));
      
      return new FixedMerkleTree(MERKLE_TREE_HEIGHT, leaves, { 
        hashFunction: (left: any, right: any) => poseidonHash2(BigInt(left), BigInt(right)).toString()
      });
    } catch (error) {
      console.error('Failed to build merkle tree:', error);
      // If no events found, start with empty tree
      return new FixedMerkleTree(MERKLE_TREE_HEIGHT, [], { 
        hashFunction: (left: any, right: any) => poseidonHash2(BigInt(left), BigInt(right)).toString()
      });
    }
  }

  // Get proof function (exactly like reference)
  async getProof(params: {
    inputs: Utxo[];
    outputs: Utxo[];
    tree: FixedMerkleTree;
    extAmount: bigint;
    fee: bigint;
    recipient: string;
    relayer: string;
  }): Promise<{ extData: any; args: any }> {
    const { inputs, outputs, tree, extAmount, fee, recipient, relayer } = params;

    // Shuffle inputs and outputs (like reference)
    const shuffledInputs = this.shuffle([...inputs]);
    const shuffledOutputs = this.shuffle([...outputs]);

    const inputMerklePathIndices: number[] = [];
    const inputMerklePathElements: string[][] = [];

    for (const input of shuffledInputs) {
      if (input.amount > 0n) {
        const commitment = toFixedHex(input.getCommitment());
        input.index = tree.indexOf(commitment);
        if (input.index < 0) {
          throw new Error(`Input commitment ${commitment} was not found`);
        }
        inputMerklePathIndices.push(input.index);
        inputMerklePathElements.push(tree.path(input.index).pathElements);
      } else {
        inputMerklePathIndices.push(0);
        inputMerklePathElements.push(new Array(tree.levels).fill('0'));
      }
    }

    const extData = {
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee),
      encryptedOutput1: await shuffledOutputs[0].encrypt(),
      encryptedOutput2: await shuffledOutputs[1].encrypt(),
    };

    const extDataHash = this.proofGenerator.computeExtDataHash(
      recipient,
      extAmount,
      relayer,
      fee,
      extData.encryptedOutput1,
      extData.encryptedOutput2
    );

    const publicAmount = this.proofGenerator.calculatePublicAmount(extAmount, fee);

    const input = {
      root: tree.root,
      inputNullifier: shuffledInputs.map(x => x.getNullifier().toString()),
      outputCommitment: shuffledOutputs.map(x => x.getCommitment().toString()),
      publicAmount: publicAmount.toString(),
      extDataHash: extDataHash.toString(),

      // Data for 2 transaction inputs
      inAmount: shuffledInputs.map(x => x.amount.toString()),
      inPrivateKey: shuffledInputs.map(x => x.keypair.privkey || '0'),
      inBlinding: shuffledInputs.map(x => x.blinding.toString()),
      inPathIndices: inputMerklePathIndices,
      inPathElements: inputMerklePathElements,

      // Data for 2 transaction outputs
      outAmount: shuffledOutputs.map(x => x.amount.toString()),
      outBlinding: shuffledOutputs.map(x => x.blinding.toString()),
      outPubkey: shuffledOutputs.map(x => x.keypair.pubkey.toString()),
    };

    // Generate proof using snarkjs (like reference)
    const { proof, publicSignals } = await this.proofGenerator.generateProof({
      inputs: shuffledInputs,
      outputs: shuffledOutputs,
      recipient,
      extAmount,
      relayer,
      fee,
      encryptedOutput1: extData.encryptedOutput1,
      encryptedOutput2: extData.encryptedOutput2
    }, tree as any);

    const args = {
      proof,
      root: toFixedHex(input.root),
      inputNullifiers: shuffledInputs.map(x => toFixedHex(x.getNullifier())),
      outputCommitments: shuffledOutputs.map(x => toFixedHex(x.getCommitment())),
      publicAmount: toFixedHex(input.publicAmount),
      extDataHash: toFixedHex(extDataHash),
    };

    return { extData, args };
  }

  // Prepare transaction (exactly like reference)
  async prepareTransaction(params: {
    inputs?: Utxo[];
    outputs?: Utxo[];
    fee?: bigint;
    recipient?: string;
    relayer?: string;
  }): Promise<{ args: any; extData: any }> {
    let { inputs = [], outputs = [], fee = 0n, recipient = '0x0', relayer = '0x0' } = params;

    if (inputs.length > 2 || outputs.length > 2) {
      throw new Error('Incorrect inputs/outputs count');
    }

    // Pad to exactly 2 inputs and 2 outputs (like reference)
    while (inputs.length < 2) {
      inputs.push(new Utxo()); // Empty UTXO (amount = 0)
    }
    while (outputs.length < 2) {
      outputs.push(new Utxo()); // Empty UTXO (amount = 0)
    }

    // Calculate external amount (like reference)
    const inputSum = inputs.reduce((sum, x) => sum + x.amount, 0n);
    const outputSum = outputs.reduce((sum, x) => sum + x.amount, 0n);
    const extAmount = fee + outputSum - inputSum;

    const { args, extData } = await this.getProof({
      inputs,
      outputs,
      tree: await this.buildMerkleTree(),
      extAmount,
      fee,
      recipient,
      relayer,
    });

    return { args, extData };
  }

  // Shuffle function (like reference)
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    let currentIndex = result.length;
    let randomIndex: number;

    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
    }

    return result;
  }

  // Build a shielded transaction using the proper prepare method
  async buildShieldedTransaction(
    account: Account,
    params: ShieldedTransactionParams
  ): Promise<{
    transaction: SimpleTransaction;
    senderAuthenticator: AccountAuthenticator;
  }> {
    try {
      // Use the proper transaction preparation like in the reference
      const { args, extData } = await this.prepareTransaction({
        inputs: params.inputs,
        outputs: params.outputs,
        fee: params.fee,
        recipient: params.recipient,
        relayer: params.relayer,
      });

      // Extract proof components
      const proofA = {
        x: BigInt(args.proof.pi_a[0]),
        y: BigInt(args.proof.pi_a[1])
      };
      const proofB = {
        x1: BigInt(args.proof.pi_b[0][0]),
        y1: BigInt(args.proof.pi_b[0][1]),
        x2: BigInt(args.proof.pi_b[1][0]),
        y2: BigInt(args.proof.pi_b[1][1])
      };
      const proofC = {
        x: BigInt(args.proof.pi_c[0]),
        y: BigInt(args.proof.pi_c[1])
      };

      // Extract public signals
      const root = BigInt(args.root);
      const publicAmount = BigInt(args.publicAmount);
      const extDataHash = BigInt(args.extDataHash);
      const inputNullifiers = args.inputNullifiers.map((n: string) => BigInt(n));
      const outputCommitments = args.outputCommitments.map((c: string) => BigInt(c));

      // Build transaction payload
      const transaction = await this.aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${this.poolAddress}::pool::transact`,
          functionArguments: [
            // Proof components
            new U256(proofA.x),
            new U256(proofA.y),
            new U256(proofB.x1),
            new U256(proofB.y1),
            new U256(proofB.x2),
            new U256(proofB.y2),
            new U256(proofC.x),
            new U256(proofC.y),
            
            // Public inputs
            new U256(root),
            new MoveVector(inputNullifiers.map(n => new U256(n))),
            new MoveVector(outputCommitments.map(c => new U256(c))),
            new U256(publicAmount),
            new U256(extDataHash),
            
            // External data
            AccountAddress.from(extData.recipient),
            new U256(BigInt(extData.extAmount)),
            AccountAddress.from(extData.relayer),
            BigInt(extData.fee),
            new MoveString(extData.encryptedOutput1),
            new MoveString(extData.encryptedOutput2)
          ]
        }
      });

      // Sign transaction
      const senderAuthenticator = this.aptos.transaction.sign({
        signer: account,
        transaction
      });

      return {
        transaction,
        senderAuthenticator
      };

    } catch (error) {
      console.error('Failed to build shielded transaction:', error);
      throw error;
    }
  }

  // Transaction function (like reference)
  async transaction(params: {
    inputs?: Utxo[];
    outputs?: Utxo[];
    fee?: bigint;
    recipient?: string;
    relayer?: string;
    account: Account;
  }): Promise<any> {
    const { account, ...rest } = params;
    const { args, extData } = await this.prepareTransaction(rest);

    return this.buildShieldedTransaction(account, {
      inputs: rest.inputs || [],
      outputs: rest.outputs || [],
      recipient: rest.recipient || '0x0',
      extAmount: BigInt(extData.extAmount),
      relayer: rest.relayer || '0x0',
      fee: rest.fee || 0n
    });
  }

  // Serialize transaction for x402 payment
  serializeForPayment(
    transaction: SimpleTransaction,
    senderAuthenticator: AccountAuthenticator
  ): string {
    try {
      // Serialize transaction and authenticator
      const serializer = new Serializer();
      
      // Serialize the transaction
      transaction.serialize(serializer);
      const transactionBytes = serializer.toUint8Array();
      
      // Serialize the authenticator
      const authSerializer = new Serializer();
      senderAuthenticator.serialize(authSerializer);
      const authBytes = authSerializer.toUint8Array();

      // Create payload object
      const payload = {
        transaction: Array.from(transactionBytes),
        senderAuthenticator: Array.from(authBytes)
      };

      // Encode as base64
      return btoa(JSON.stringify(payload));

    } catch (error) {
      console.error('Failed to serialize transaction:', error);
      throw error;
    }
  }

  async createDepositTransaction(
    account: Account,
    amount: bigint,
    outputUtxo: Utxo
  ): Promise<{
    transaction: SimpleTransaction;
    senderAuthenticator: AccountAuthenticator;
    serialized: string;
  }> {
    const { transaction, senderAuthenticator } = await this.transaction({
      account,
      inputs: [], // No inputs for deposit
      outputs: [outputUtxo], // Will be padded to 2 with empty UTXO
      fee: 0n,
      recipient: '0x0000000000000000000000000000000000000000000000000000000000000000',
      relayer: account.accountAddress.toString()
    });

    const serialized = this.serializeForPayment(transaction, senderAuthenticator);

    return {
      transaction,
      senderAuthenticator,
      serialized
    };
  }

  // Create a payment transaction
  async createPaymentTransaction(
    account: Account,
    inputUtxos: Utxo[],
    paymentAmount: bigint,
    recipientShieldedKey: string,
    changeUtxo: Utxo,
    relayerAddress: string,
    fee: bigint = 0n
  ): Promise<{
    transaction: SimpleTransaction;
    senderAuthenticator: AccountAuthenticator;
    serialized: string;
  }> {
    // Create payment UTXO for recipient
    const paymentUtxo = new Utxo({
      amount: paymentAmount,
      keypair: inputUtxos[0].keypair // This should be the recipient's keypair
    });

    const { transaction, senderAuthenticator } = await this.transaction({
      account,
      inputs: inputUtxos,
      outputs: [paymentUtxo, changeUtxo],
      fee,
      recipient: '0x0000000000000000000000000000000000000000000000000000000000000000', // No withdrawal
      relayer: relayerAddress
    });

    const serialized = this.serializeForPayment(transaction, senderAuthenticator);

    return {
      transaction,
      senderAuthenticator,
      serialized
    };
  }
}