import { poseidonHash, toBuffer, randomBN } from './utils';
import { Keypair } from './keypair';

export interface UtxoData {
  amount?: bigint;
  keypair?: Keypair;
  blinding?: bigint;
  index?: number | null;
}

export class Utxo {
  public amount: bigint;
  public blinding: bigint;
  public keypair: Keypair;
  public index: number | null;
  private _commitment: bigint | null = null;
  private _nullifier: bigint | null = null;

  constructor({ amount = 0n, keypair = new Keypair(), blinding = randomBN(), index = null }: UtxoData = {}) {
    this.amount = BigInt(amount);
    this.blinding = BigInt(blinding);
    this.keypair = keypair;
    this.index = index;
  }

  getCommitment(): bigint {
    if (!this._commitment) {
      this._commitment = BigInt(poseidonHash([this.amount, this.keypair.pubkey, this.blinding]));
    }
    return this._commitment;
  }

  getNullifier(): bigint {
    if (!this._nullifier) {
      if (
        this.amount > 0n &&
        (this.index === undefined ||
          this.index === null ||
          this.keypair.privkey === undefined ||
          this.keypair.privkey === null)
      ) {
        throw new Error('Cannot compute nullifier without utxo index or private key');
      }
      
      const signature = this.keypair.privkey ? 
        this.keypair.sign(this.getCommitment(), this.index || 0) : 0n;
      
      this._nullifier = BigInt(poseidonHash([
        this.getCommitment(), 
        BigInt(this.index || 0), 
        signature
      ]));
    }
    return this._nullifier;
  }

  async encrypt(): Promise<string> {
    const amountBuffer = toBuffer(this.amount, 31);
    const blindingBuffer = toBuffer(this.blinding, 31);
    const bytes = Buffer.concat([amountBuffer, blindingBuffer]);
    return await this.keypair.encrypt(bytes);
  }

  static async decrypt(keypair: Keypair, data: string, index: number): Promise<Utxo> {
    const buf = await keypair.decrypt(data);
    return new Utxo({
      amount: BigInt('0x' + buf.slice(0, 31).toString('hex')),
      blinding: BigInt('0x' + buf.slice(31, 62).toString('hex')),
      keypair,
      index,
    });
  }

  // Convert to format suitable for circuit inputs
  toCircuitInputs() {
    return {
      amount: this.amount.toString(),
      pubkey: this.keypair.pubkey.toString(),
      blinding: this.blinding.toString(),
      commitment: this.getCommitment().toString(),
      nullifier: this.getNullifier().toString(),
      index: (this.index || 0).toString()
    };
  }
}