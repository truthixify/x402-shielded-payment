import { poseidonHash, toFixedHex, toBuffer } from './utils';

// Simple encryption/decryption using Web Crypto API
async function encrypt(publicKey: string, data: string): Promise<{ nonce: string; ciphertext: string; authTag: string }> {
  const key = await crypto.subtle.importKey(
    'raw',
    Buffer.from(publicKey, 'base64'),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    encoded
  );
  
  return {
    nonce: Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join(''),
    ciphertext: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join(''),
    authTag: '' // GCM includes auth tag in ciphertext
  };
}

async function decrypt(privateKey: string, encryptedData: { nonce: string; ciphertext: string; authTag: string }): Promise<string> {
  // Create key from private key hash
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(privateKey.slice(2)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(16),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const nonce = new Uint8Array(encryptedData.nonce.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(encryptedData.ciphertext.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

function packEncryptedMessage(encryptedMessage: { nonce: string; ciphertext: string; authTag: string }): string {
  const nonceBuf = Buffer.from(encryptedMessage.nonce, 'hex');
  const ciphertextBuf = Buffer.from(encryptedMessage.ciphertext, 'hex');
  
  const messageBuff = Buffer.concat([nonceBuf, ciphertextBuf]);
  return '0x' + messageBuff.toString('hex');
}

function unpackEncryptedMessage(encryptedMessage: string) {
  if (encryptedMessage.slice(0, 2) === '0x') {
    encryptedMessage = encryptedMessage.slice(2);
  }
  
  const messageBuff = Buffer.from(encryptedMessage, 'hex');
  const nonceBuf = messageBuff.slice(0, 12);
  const ciphertextBuf = messageBuff.slice(12);
  
  return {
    nonce: nonceBuf.toString('hex'),
    ciphertext: ciphertextBuf.toString('hex'),
    authTag: ''
  };
}

export class Keypair {
  public privkey: string | null;
  public pubkey: bigint;
  public encryptionKey: string;

  constructor(privkey?: string) {
    if (!privkey) {
      // Generate random private key using Web Crypto API
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      privkey = '0x' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    this.privkey = privkey;
    this.pubkey = BigInt(poseidonHash([BigInt(this.privkey)]));
    
    // Generate encryption key from private key
    const encoder = new TextEncoder();
    const data = encoder.encode(privkey.slice(2));
    const hashArray = Array.from(new Uint8Array(data));
    this.encryptionKey = btoa(String.fromCharCode(...hashArray));
  }

  toString(): string {
    return toFixedHex(this.pubkey, 32) + Buffer.from(this.encryptionKey, 'base64').toString('hex');
  }

  address(): string {
    return this.toString();
  }

  static fromString(str: string): Keypair {
    if (str.length === 130) {
      str = str.slice(2);
    }
    if (str.length !== 128) {
      throw new Error('Invalid key length');
    }
    
    const keypair = Object.create(Keypair.prototype);
    keypair.privkey = null;
    keypair.pubkey = BigInt('0x' + str.slice(0, 64));
    keypair.encryptionKey = Buffer.from(str.slice(64, 128), 'hex').toString('base64');
    
    return keypair;
  }

  sign(commitment: bigint, merklePath?: number): bigint {
    if (!this.privkey) {
      throw new Error('Cannot sign without private key');
    }
    return BigInt(poseidonHash([BigInt(this.privkey), commitment, BigInt(merklePath || 0)]));
  }

  async encrypt(bytes: Buffer): Promise<string> {
    const data = bytes.toString('base64');
    const encrypted = await encrypt(this.encryptionKey, data);
    return packEncryptedMessage(encrypted);
  }

  async decrypt(data: string): Promise<Buffer> {
    if (!this.privkey) {
      throw new Error('Cannot decrypt without private key');
    }
    const unpacked = unpackEncryptedMessage(data);
    const decrypted = await decrypt(this.privkey, unpacked);
    return Buffer.from(decrypted, 'base64');
  }
}