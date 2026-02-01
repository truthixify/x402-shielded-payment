import * as snarkjs from 'snarkjs';
import { sha3_256 } from 'js-sha3';
import { Utxo } from './utxo';
import { FIELD_SIZE, toField, poseidonHash } from './utils';

// Simple Merkle Tree implementation
export class MerkleTree {
  public levels: number;
  public leaves: bigint[];
  private _layers: bigint[][];

  constructor(levels: number, leaves: bigint[] = []) {
    this.levels = levels;
    this.leaves = leaves;
    this._layers = [];
    this._buildTree();
  }

  private _buildTree() {
    this._layers = [];
    this._layers[0] = this.leaves.slice();

    // Pad leaves to power of 2
    const capacity = 2 ** this.levels;
    while (this._layers[0].length < capacity) {
      this._layers[0].push(0n);
    }

    // Build tree layers
    for (let level = 1; level <= this.levels; level++) {
      this._layers[level] = [];
      const currentLayer = this._layers[level - 1];
      
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1];
        const hash = BigInt(poseidonHash([left, right]));
        this._layers[level].push(hash);
      }
    }
  }

  root(): bigint {
    return this._layers[this.levels][0];
  }

  indexOf(commitment: bigint): number {
    return this.leaves.findIndex(leaf => leaf === commitment);
  }

  path(index: number): { pathElements: bigint[]; pathIndices: number[] } {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error('Index out of bounds');
    }

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let currentIndex = index;

    for (let level = 0; level < this.levels; level++) {
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      
      pathElements.push(this._layers[level][siblingIndex] || 0n);
      pathIndices.push(isRightNode ? 1 : 0);
      
      currentIndex = Math.floor(currentIndex / 2);
    }

    return { pathElements, pathIndices };
  }

  insert(commitment: bigint): number {
    const index = this.leaves.length;
    this.leaves.push(commitment);
    this._buildTree();
    return index;
  }
}

export interface ProofInputs {
  // Public inputs
  root: string;
  publicAmount: string;
  extDataHash: string;
  inputNullifier: string[];
  outputCommitment: string[];
  
  // Private inputs
  inAmount: string[];
  inPrivateKey: string[];
  inBlinding: string[];
  inPathIndices: number[][];
  inPathElements: bigint[][];
  
  outAmount: string[];
  outBlinding: string[];
  outPubkey: string[];
}

export interface TransactionData {
  inputs: Utxo[];
  outputs: Utxo[];
  recipient: string;
  extAmount: bigint;
  relayer: string;
  fee: bigint;
  encryptedOutput1: string;
  encryptedOutput2: string;
}

export class ProofGenerator {
  private wasmPath: string;
  private zkeyPath: string;
  private merkleTreeHeight: number;

  constructor(merkleTreeHeight: number = 20) {
    // Use the actual circuit files from public directory
    this.wasmPath = '/circuit.wasm';
    this.zkeyPath = '/circuit.zkey';
    this.merkleTreeHeight = merkleTreeHeight;
  }

  // Build merkle tree from commitments (similar to buildMerkleTree in reference)
  buildMerkleTreeFromCommitments(commitments: bigint[]): MerkleTree {
    return new MerkleTree(this.merkleTreeHeight, commitments);
  }

  // Prepare transaction similar to prepareTransaction in reference
  async prepareTransaction(params: {
    inputs?: Utxo[];
    outputs?: Utxo[];
    fee?: bigint;
    recipient?: string;
    relayer?: string;
    merkleTree: MerkleTree;
  }): Promise<{ inputs: ProofInputs; extData: any }> {
    let { inputs = [], outputs = [], fee = 0n, recipient = '0x0', relayer = '0x0', merkleTree } = params;

    // Pad inputs and outputs like in the reference
    if (inputs.length > 2) {
      throw new Error('Too many inputs');
    }
    if (outputs.length > 2) {
      throw new Error('Too many outputs');
    }

    // Pad to exactly 2 inputs and 2 outputs
    while (inputs.length < 2) {
      inputs.push(new Utxo()); // Empty UTXO (amount = 0)
    }
    while (outputs.length < 2) {
      outputs.push(new Utxo()); // Empty UTXO (amount = 0)
    }

    // Calculate external amount like in reference
    const inputSum = inputs.reduce((sum, utxo) => sum + utxo.amount, 0n);
    const outputSum = outputs.reduce((sum, utxo) => sum + utxo.amount, 0n);
    const extAmount = fee + outputSum - inputSum;

    // Encrypt outputs
    const encryptedOutput1 = await outputs[0].encrypt();
    const encryptedOutput2 = await outputs[1].encrypt();

    // Create external data object
    const extData = {
      recipient,
      extAmount,
      relayer,
      fee,
      encryptedOutput1,
      encryptedOutput2
    };

    // Prepare transaction data
    const txData: TransactionData = {
      inputs,
      outputs,
      recipient,
      extAmount,
      relayer,
      fee,
      encryptedOutput1,
      encryptedOutput2
    };

    const circuitInputs = this.prepareInputs(txData, merkleTree);

    return {
      inputs: circuitInputs,
      extData
    };
  }

  // Calculate public amount from external amount and fee
  calculatePublicAmount(extAmount: bigint, fee: bigint): bigint {
    const MAX_FEE = BigInt('452312848583266388373324160190187140051835877600158453279131187530910662656');
    const MAX_EXT_AMOUNT = BigInt('452312848583266388373324160190187140051835877600158453279131187530910662656');
    
    if (fee >= MAX_FEE) {
      throw new Error('Invalid fee');
    }
    if (extAmount >= MAX_EXT_AMOUNT) {
      throw new Error('Invalid ext amount');
    }
    
    // Calculate: extAmount - fee, handling negative values with field arithmetic
    const publicAmount = extAmount >= fee ? 
      extAmount - fee : 
      FIELD_SIZE - (fee - extAmount);
    
    return toField(publicAmount);
  }

  // Compute external data hash (matching the Move contract implementation)
  computeExtDataHash(
    recipient: string,
    extAmount: bigint,
    relayer: string,
    fee: bigint,
    encryptedOutput1: string,
    encryptedOutput2: string
  ): bigint {
    // This should match the compute_ext_data_hash function in the Move contract
    // The Move contract uses BCS serialization + SHA3-256
    
    // Convert inputs to bytes in the same order as Move contract
    const recipientBytes = this.addressToBytes(recipient);
    const extAmountBytes = this.u256ToBytes(extAmount);
    const relayerBytes = this.addressToBytes(relayer);
    const feeBytes = this.u64ToBytes(fee);
    const encryptedOutput1Bytes = this.hexToBytes(encryptedOutput1);
    const encryptedOutput2Bytes = this.hexToBytes(encryptedOutput2);
    
    // Concatenate all bytes in the same order as Move contract
    const hashInput = new Uint8Array([
      ...recipientBytes,
      ...extAmountBytes,
      ...relayerBytes,
      ...feeBytes,
      ...encryptedOutput1Bytes,
      ...encryptedOutput2Bytes
    ]);
    
    // Use SHA3-256 (same as Move contract)
    const hash = this.sha3_256(hashInput);
    
    // Convert to u256 little-endian (same as Move contract)
    const result = this.bytesToU256LittleEndian(hash);
    
    return result % FIELD_SIZE;
  }

  // Helper functions to match Move contract serialization
  private addressToBytes(address: string): Uint8Array {
    // Remove 0x prefix and pad to 32 bytes (Move addresses are 32 bytes)
    const hex = address.startsWith('0x') ? address.slice(2) : address;
    const padded = hex.padStart(64, '0');
    return this.hexToBytes('0x' + padded);
  }

  private u256ToBytes(value: bigint): Uint8Array {
    // Convert u256 to 32-byte little-endian (BCS format)
    const bytes = new Uint8Array(32);
    let val = value;
    for (let i = 0; i < 32; i++) {
      bytes[i] = Number(val & 0xFFn);
      val = val >> 8n;
    }
    return bytes;
  }

  private u64ToBytes(value: bigint): Uint8Array {
    // Convert u64 to 8-byte little-endian (BCS format)
    const bytes = new Uint8Array(8);
    let val = value;
    for (let i = 0; i < 8; i++) {
      bytes[i] = Number(val & 0xFFn);
      val = val >> 8n;
    }
    return bytes;
  }

  private hexToBytes(hex: string): Uint8Array {
    if (hex.startsWith('0x')) {
      hex = hex.slice(2);
    }
    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private sha3_256(data: Uint8Array): Uint8Array {
    // Use proper SHA3-256 implementation
    const hashHex = sha3_256(data);
    return this.hexToBytes('0x' + hashHex);
  }

  private bytesToU256LittleEndian(bytes: Uint8Array): bigint {
    // Convert bytes to u256 little-endian (same as Move contract)
    let result = 0n;
    const len = Math.min(bytes.length, 32);
    
    for (let i = 0; i < len; i++) {
      result = result + (BigInt(bytes[i]) << (8n * BigInt(i)));
    }
    
    return result;
  }

  // Shuffle array (for privacy)
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Prepare circuit inputs from transaction data
  prepareInputs(txData: TransactionData, merkleTree: MerkleTree): ProofInputs {
    // Shuffle inputs and outputs for privacy
    const shuffledInputs = this.shuffle(txData.inputs);
    const shuffledOutputs = this.shuffle(txData.outputs);

    // Pad inputs to required size (2 inputs for transaction2 circuit)
    const paddedInputs = [...shuffledInputs];
    while (paddedInputs.length < 2) {
      paddedInputs.push(new Utxo()); // Empty UTXO (amount = 0)
    }

    // Pad outputs to required size (2 outputs)
    const paddedOutputs = [...shuffledOutputs];
    while (paddedOutputs.length < 2) {
      paddedOutputs.push(new Utxo()); // Empty UTXO (amount = 0)
    }

    // Get merkle paths for inputs
    const inputMerklePathIndices: number[][] = [];
    const inputMerklePathElements: bigint[][] = [];

    for (const input of paddedInputs) {
      if (input.amount > 0n) {
        const commitment = input.getCommitment();
        const index = merkleTree.indexOf(commitment);
        
        if (index < 0) {
          throw new Error(`Input commitment ${commitment.toString(16)} was not found in merkle tree`);
        }
        
        input.index = index;
        const path = merkleTree.path(index);
        inputMerklePathIndices.push(path.pathIndices);
        inputMerklePathElements.push(path.pathElements);
      } else {
        // Dummy input
        inputMerklePathIndices.push(new Array(this.merkleTreeHeight).fill(0));
        inputMerklePathElements.push(new Array(this.merkleTreeHeight).fill(0n));
      }
    }

    const publicAmount = this.calculatePublicAmount(txData.extAmount, txData.fee);
    const extDataHash = this.computeExtDataHash(
      txData.recipient,
      txData.extAmount,
      txData.relayer,
      txData.fee,
      txData.encryptedOutput1,
      txData.encryptedOutput2
    );

    return {
      // Public inputs
      root: merkleTree.root().toString(),
      publicAmount: publicAmount.toString(),
      extDataHash: extDataHash.toString(),
      inputNullifier: paddedInputs.map(utxo => utxo.getNullifier().toString()),
      outputCommitment: paddedOutputs.map(utxo => utxo.getCommitment().toString()),
      
      // Private inputs
      inAmount: paddedInputs.map(utxo => utxo.amount.toString()),
      inPrivateKey: paddedInputs.map(utxo => utxo.keypair.privkey || '0'),
      inBlinding: paddedInputs.map(utxo => utxo.blinding.toString()),
      inPathIndices: inputMerklePathIndices,
      inPathElements: inputMerklePathElements,
      
      outAmount: paddedOutputs.map(utxo => utxo.amount.toString()),
      outBlinding: paddedOutputs.map(utxo => utxo.blinding.toString()),
      outPubkey: paddedOutputs.map(utxo => utxo.keypair.pubkey.toString()),
    };
  }

  // Generate ZK proof
  async generateProof(txData: TransactionData, merkleTree: MerkleTree): Promise<{
    proof: any;
    publicSignals: string[];
  }> {
    try {
      const inputs = this.prepareInputs(txData, merkleTree);
      
      console.log('Generating proof with inputs:', {
        root: inputs.root,
        publicAmount: inputs.publicAmount,
        extDataHash: inputs.extDataHash,
        inputCount: inputs.inputNullifier.length,
        outputCount: inputs.outputCommitment.length
      });
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        this.wasmPath,
        this.zkeyPath
      );
      
      return { proof, publicSignals };
      
    } catch (error) {
      console.error('Proof generation failed:', error);
      throw error;
    }
  }

  // Verify a proof (for testing)
  async verifyProof(proof: any, publicSignals: string[], vkeyPath: string): Promise<boolean> {
    try {
      const vKey = await fetch(vkeyPath).then(r => r.json());
      return await snarkjs.groth16.verify(vKey, publicSignals, proof);
    } catch (error) {
      console.error('Proof verification failed:', error);
      return false;
    }
  }
}