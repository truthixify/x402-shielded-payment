import { buildPoseidon } from 'circomlib';

let poseidon: any;

// Initialize Poseidon hash function
export async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

export function poseidonHash(inputs: (bigint | string | number)[]): string {
  if (!poseidon) {
    throw new Error('Poseidon not initialized. Call initPoseidon() first.');
  }
  
  // Convert inputs to proper format for poseidon
  const formattedInputs = inputs.map(input => {
    if (typeof input === 'bigint') return input;
    if (typeof input === 'string') return BigInt(input);
    if (typeof input === 'number') return BigInt(input);
    return BigInt(input.toString());
  });
  
  const hash = poseidon(formattedInputs);
  return poseidon.F.toString(hash);
}

export function toFixedHex(number: bigint | string | number, length = 32): string {
  const str = BigInt(number).toString(16);
  return '0x' + str.padStart(length * 2, '0');
}

export function toBuffer(number: bigint | string | number, length = 32): Buffer {
  const hex = BigInt(number).toString(16).padStart(length * 2, '0');
  return Buffer.from(hex, 'hex');
}

export function randomBN(): bigint {
  // Use Web Crypto API for browser compatibility
  const array = new Uint8Array(31);
  crypto.getRandomValues(array);
  return BigInt('0x' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join(''));
}

export function bigIntToHex(bigint: bigint): string {
  return '0x' + bigint.toString(16);
}

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

// Field size for BN254 curve
export const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

export function toField(value: bigint | string | number): bigint {
  const bigintValue = BigInt(value);
  return bigintValue % FIELD_SIZE;
}

// Utility for class names
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}