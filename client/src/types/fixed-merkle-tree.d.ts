declare module 'fixed-merkle-tree' {
  export interface MerkleTreeOptions {
    hashFunction?: (left: any, right: any) => string;
    zeroElement?: string;
  }

  export interface PathElement {
    pathElements: string[];
    pathIndices: number[];
  }

  export default class FixedMerkleTree {
    public levels: number;
    public root: string;
    public zeroElement: string;

    constructor(levels: number, elements?: string[], options?: MerkleTreeOptions);

    indexOf(element: string): number;
    path(index: number): PathElement;
    insert(element: string): void;
    update(index: number, element: string): void;
    bulkInsert(elements: string[]): void;
    toString(): string;
    serialize(): object;
    static deserialize(data: object, hashFunction?: (left: any, right: any) => string): FixedMerkleTree;
  }
}