module shielded_pool::merkle_tree {
    use std::vector;
    use shielded_pool::poseidon;

    /// Error codes
    /// Tree is full, no more leaves can be added
    const ETREE_FULL: u64 = 1;
    /// Invalid merkle root
    const EINVALID_ROOT: u64 = 2;
    /// Index out of bounds
    const EINDEX_OUT_OF_BOUNDS: u64 = 3;

    const FIELD_SIZE: u256 = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    const ZERO_VALUE: u256 = 21663839004416932945382355908790599225266501822907911457504978515578255421292;
    const ROOT_HISTORY_SIZE: u32 = 100;

    struct MerkleTree has key, store, drop {
        levels: u32,
        filled_subtrees: vector<u256>,
        roots: vector<u256>,
        current_root_index: u32,
        next_index: u32,
    }

    #[event]
    struct NewCommitment has drop, store {
        commitment: u256,
        leaf_index: u32,
        encrypted_output: vector<u8>,
    }

    // Poseidon hash function for production use
    fun poseidon_hash(left: u256, right: u256): u256 {
        poseidon::poseidon_hash_2(left, right)
    }

    // Get zero value for level i
    fun zeros(i: u32): u256 {
        if (i == 0) 0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c
        else if (i == 1) 0x1a332ca2cd2436bdc6796e6e4244ebf6f7e359868b7252e55342f766e4088082
        else if (i == 2) 0x2fb19ac27499bdf9d7d3b387eff42b6d12bffbc6206e81d0ef0b0d6b24520ebd
        else if (i == 3) 0x18d0d6e282d4eacbf18efc619a986db763b75095ed122fac7d4a49418daa42e1
        else if (i == 4) 0x054dec40f76a0f5aaeff1a85a4a3721b92b4ad244362d30b0ef8ed7033de11d3
        else if (i == 5) 0x1d24c91f8d40f1c2591edec19d392905cf5eb01eada48d71836177ef11aea5b2
        else if (i == 6) 0x0fb63621cfc047eba2159faecfa55b120d7c81c0722633ef94e20e27675e378f
        else if (i == 7) 0x277b08f214fe8c5504a79614cdec5abd7b6adc9133fe926398684c82fd798b44
        else if (i == 8) 0x2633613437c1fd97f7c798e2ea30d52cfddee56d74f856a541320ae86ddaf2de
        else if (i == 9) 0x00768963fa4b993fbfece3619bfaa3ca4afd7e3864f11b09a0849dbf4ad25807
        else if (i == 10) 0x0e63ff9df484c1a21478bd27111763ef203177ec0a7ef3a3cd43ec909f587bb0
        else if (i == 11) 0x0e6a4bfb0dd0ac8bf5517eaac48a95ba783dabe9f64494f9c892d3e8431eaab3
        else if (i == 12) 0x0164a46b3ffff8baca00de7a130a63d105f1578076838502b99488505d5b3d35
        else if (i == 13) 0x145a6f1521c02b250cc76eb35cd67c9b0b22473577de3778e4c51903836c8957
        else if (i == 14) 0x29849fc5b55303a660bad33d986fd156d48516ec58a0f0a561a03b704a802254
        else if (i == 15) 0x26639dd486b374e98ac6da34e8651b3fca58c51f1c2f857dd82045f27fc8dbe6
        else if (i == 16) 0x2aa39214b887ee877e60afdb191390344c68177c30a0b8646649774174de5e33
        else if (i == 17) 0x09b397d253e41a521d042ffe01f8c33ae37d4c7da21af68693aafb63d599d708
        else if (i == 18) 0x02fbfd397ad901cea38553239aefec016fcb6a19899038503f04814cbb79a511
        else if (i == 19) 0x266640a877ec97a91f6c95637f843eeac8718f53f311bac9cba7d958df646f9d
        else if (i == 20) 0x29f9a0a07a22ab214d00aaa0190f54509e853f3119009baecb0035347606b0a9
        else 0x0a1fda67bffa0ab3a755f23fdcf922720820b6a96616a5ca34643cd0b935e3d6
    }

    // Initialize merkle tree
    public fun initialize(levels: u32): MerkleTree {
        assert!(levels > 0 && levels < 32, EINDEX_OUT_OF_BOUNDS);
        
        let filled_subtrees = vector::empty<u256>();
        let i = 0;
        while (i < levels) {
            vector::push_back(&mut filled_subtrees, zeros(i));
            i = i + 1;
        };

        let roots = vector::empty<u256>();
        vector::push_back(&mut roots, zeros(levels));
        
        // Fill remaining root history slots with zeros
        let j = 1;
        while (j < ROOT_HISTORY_SIZE) {
            vector::push_back(&mut roots, 0);
            j = j + 1;
        };

        MerkleTree {
            levels,
            filled_subtrees,
            roots,
            current_root_index: 0,
            next_index: 0,
        }
    }

    // Hash two leaves
    public fun hash_left_right(left: u256, right: u256): u256 {
        assert!(left < FIELD_SIZE, EINVALID_ROOT);
        assert!(right < FIELD_SIZE, EINVALID_ROOT);
        poseidon_hash(left, right)
    }

    // Insert a pair of leaves (for efficiency)
    public fun insert_pair(tree: &mut MerkleTree, leaf1: u256, leaf2: u256): u32 {
        let next_index = tree.next_index;
        assert!(next_index != (1u32 << (tree.levels as u8)), ETREE_FULL);
        
        let current_index = next_index / 2;
        let current_level_hash = hash_left_right(leaf1, leaf2);
        let left: u256;
        let right: u256;
        
        let i = 1;
        while (i < tree.levels) {
            if (current_index % 2 == 0) {
                left = current_level_hash;
                right = zeros(i);
                *vector::borrow_mut(&mut tree.filled_subtrees, (i as u64)) = current_level_hash;
            } else {
                left = *vector::borrow(&tree.filled_subtrees, (i as u64));
                right = current_level_hash;
            };
            
            current_level_hash = hash_left_right(left, right);
            current_index = current_index / 2;
            i = i + 1;
        };

        let new_root_index = (tree.current_root_index + 1) % ROOT_HISTORY_SIZE;
        tree.current_root_index = new_root_index;
        *vector::borrow_mut(&mut tree.roots, (new_root_index as u64)) = current_level_hash;
        tree.next_index = next_index + 2;
        
        next_index
    }

    // Check if root is known (exists in history)
    public fun is_known_root(tree: &MerkleTree, root: u256): bool {
        if (root == 0) {
            return false
        };
        
        let current_root_index = tree.current_root_index;
        let i = current_root_index;
        
        loop {
            if (root == *vector::borrow(&tree.roots, (i as u64))) {
                return true
            };
            
            if (i == 0) {
                i = ROOT_HISTORY_SIZE;
            };
            i = i - 1;
            
            if (i == current_root_index) {
                break
            };
        };
        
        false
    }

    // Get the last root
    public fun get_last_root(tree: &MerkleTree): u256 {
        *vector::borrow(&tree.roots, (tree.current_root_index as u64))
    }

    // Get next index
    public fun get_next_index(tree: &MerkleTree): u32 {
        tree.next_index
    }
}