module shielded_pool::pool {
    use std::vector;
    use std::signer;
    use aptos_framework::object::Object;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::event;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_std::table::{Self, Table};
    use std::bcs;
    use shielded_pool::merkle_tree::{Self, MerkleTree};
    use shielded_pool::groth16_verifier;

    /// Error codes
    /// Not authorized to perform this action
    const ENOT_AUTHORIZED: u64 = 1;
    /// Invalid external data hash
    const EINVALID_EXT_DATA_HASH: u64 = 2;
    /// Invalid public amount
    const EINVALID_PUBLIC_AMOUNT: u64 = 3;
    /// Invalid transaction proof
    const EINVALID_PROOF: u64 = 4;
    /// Input already spent (nullifier already used)
    const EINPUT_ALREADY_SPENT: u64 = 5;
    /// Invalid merkle root
    const EINVALID_MERKLE_ROOT: u64 = 6;
    /// Cannot withdraw to zero address
    const ECANNOT_WITHDRAW_TO_ZERO: u64 = 7;
    /// Amount exceeds maximum deposit limit
    const EAMOUNT_EXCEEDS_LIMIT: u64 = 8;
    /// Invalid fee amount
    const EINVALID_FEE: u64 = 9;
    /// Invalid external amount
    const EINVALID_EXT_AMOUNT: u64 = 10;

    const MAX_EXT_AMOUNT: u256 = 452312848583266388373324160190187140051835877600158453279131187530910662656; // 2^248
    const MAX_FEE: u256 = 452312848583266388373324160190187140051835877600158453279131187530910662656; // 2^248
    const FIELD_SIZE: u256 = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct ShieldedPool has key {
        merkle_tree: MerkleTree,
        nullifier_hashes: Table<u256, bool>,
        maximum_deposit_amount: u64,
        admin: address,
        token_metadata: Object<Metadata>,
        signer_cap: SignerCapability,
    }

    struct ExtData has copy, drop {
        recipient: address,
        ext_amount: u256, // Using u256 to handle negative values via field arithmetic
        relayer: address,
        fee: u64,
        encrypted_output1: vector<u8>,
        encrypted_output2: vector<u8>,
    }

    struct Proof has copy, drop {
        proof_a_x: u256,
        proof_a_y: u256,
        proof_b_x1: u256,
        proof_b_y1: u256,
        proof_b_x2: u256,
        proof_b_y2: u256,
        proof_c_x: u256,
        proof_c_y: u256,
        root: u256,
        input_nullifiers: vector<u256>,
        output_commitments: vector<u256>, // Should have exactly 2 elements
        public_amount: u256,
        ext_data_hash: u256,
    }

    struct Account has copy, drop {
        owner: address,
        public_key: vector<u8>,
    }

    #[event]
    struct NewCommitment has drop, store {
        commitment: u256,
        index: u32,
        encrypted_output: vector<u8>,
    }

    #[event]
    struct NewNullifier has drop, store {
        nullifier: u256,
    }

    #[event]
    struct PublicKey has drop, store {
        owner: address,
        key: vector<u8>,
    }

    // Initialize the shielded pool - contract creates a resource account for fund management
    public entry fun initialize(
        admin: &signer,
        levels: u32,
        maximum_deposit_amount: u64,
        token_metadata: Object<Metadata>
    ) {
        let admin_addr = signer::address_of(admin);
        
        // Create resource account for fund management
        let (_resource_signer, signer_cap) = account::create_resource_account(admin, b"shielded_pool");
        
        let merkle_tree = merkle_tree::initialize(levels);
        let nullifier_hashes = table::new<u256, bool>();

        let pool = ShieldedPool {
            merkle_tree,
            nullifier_hashes,
            maximum_deposit_amount,
            admin: admin_addr,
            token_metadata,
            signer_cap,
        };

        // Store the pool at the admin's address (contract deployer)
        move_to(admin, pool);
    }

    // Register a user account with their public key
    public entry fun register(account: &signer, public_key: vector<u8>) {
        let owner = signer::address_of(account);
        
        event::emit(PublicKey {
            owner,
            key: public_key,
        });
    }

    // Main transaction function for deposits, transfers, and withdrawals
    public entry fun transact(
        user: &signer,
        // Proof parameters
        proof_a_x: u256,
        proof_a_y: u256,
        proof_b_x1: u256,
        proof_b_y1: u256,
        proof_b_x2: u256,
        proof_b_y2: u256,
        proof_c_x: u256,
        proof_c_y: u256,
        root: u256,
        input_nullifiers: vector<u256>,
        output_commitments: vector<u256>,
        public_amount: u256,
        ext_data_hash: u256,
        // External data parameters
        recipient: address,
        ext_amount: u256,
        relayer: address,
        fee: u64,
        encrypted_output1: vector<u8>,
        encrypted_output2: vector<u8>,
    ) acquires ShieldedPool {
        let pool = borrow_global_mut<ShieldedPool>(@shielded_pool);

        let proof = Proof {
            proof_a_x,
            proof_a_y,
            proof_b_x1,
            proof_b_y1,
            proof_b_x2,
            proof_b_y2,
            proof_c_x,
            proof_c_y,
            root,
            input_nullifiers,
            output_commitments,
            public_amount,
            ext_data_hash,
        };

        let ext_data = ExtData {
            recipient,
            ext_amount,
            relayer,
            fee,
            encrypted_output1,
            encrypted_output2,
        };

        // Handle deposits (positive ext_amount)
        if (ext_amount < FIELD_SIZE / 2) { // Positive amount
            assert!(ext_amount <= (pool.maximum_deposit_amount as u256), EAMOUNT_EXCEEDS_LIMIT);
            
            // Transfer tokens from user to the contract (pool) address
            let fa = primary_fungible_store::withdraw(user, pool.token_metadata, (ext_amount as u64));
            primary_fungible_store::deposit(@shielded_pool, fa);
        };

        process_transaction(pool, proof, ext_data);
    }

    // Process the main transaction logic
    fun process_transaction(
        pool: &mut ShieldedPool,
        proof: Proof,
        ext_data: ExtData,
    ) {
        // Verify merkle root
        assert!(merkle_tree::is_known_root(&pool.merkle_tree, proof.root), EINVALID_MERKLE_ROOT);

        // Check nullifiers haven't been used
        let i = 0;
        let nullifier_len = vector::length(&proof.input_nullifiers);
        while (i < nullifier_len) {
            let nullifier = *vector::borrow(&proof.input_nullifiers, i);
            assert!(!table::contains(&pool.nullifier_hashes, nullifier), EINPUT_ALREADY_SPENT);
            i = i + 1;
        };

        // Verify external data hash
        let computed_ext_data_hash = compute_ext_data_hash(&ext_data);
        assert!(proof.ext_data_hash == computed_ext_data_hash, EINVALID_EXT_DATA_HASH);

        // Verify public amount calculation
        let computed_public_amount = calculate_public_amount(ext_data.ext_amount, ext_data.fee);
        assert!(proof.public_amount == computed_public_amount, EINVALID_PUBLIC_AMOUNT);

        // Verify ZK proof
        assert!(verify_proof(&proof), EINVALID_PROOF);

        // Mark nullifiers as spent
        let j = 0;
        while (j < nullifier_len) {
            let nullifier = *vector::borrow(&proof.input_nullifiers, j);
            table::add(&mut pool.nullifier_hashes, nullifier, true);
            event::emit(NewNullifier { nullifier });
            j = j + 1;
        };

        // Handle withdrawals (negative ext_amount represented as large positive)
        if (ext_data.ext_amount >= FIELD_SIZE / 2) { // Negative amount
            assert!(ext_data.recipient != @0x0, ECANNOT_WITHDRAW_TO_ZERO);
            
            let withdrawal_amount = FIELD_SIZE - ext_data.ext_amount;
            // Use the resource account signer capability for withdrawals
            let pool_signer = account::create_signer_with_capability(&pool.signer_cap);
            let fa = primary_fungible_store::withdraw(&pool_signer, pool.token_metadata, (withdrawal_amount as u64));
            primary_fungible_store::deposit(ext_data.recipient, fa);
        };

        // Handle relayer fee
        if (ext_data.fee > 0) {
            // Use the resource account signer capability for fee payments
            let pool_signer = account::create_signer_with_capability(&pool.signer_cap);
            let fee_fa = primary_fungible_store::withdraw(&pool_signer, pool.token_metadata, (ext_data.fee as u64));
            primary_fungible_store::deposit(ext_data.relayer, fee_fa);
        };

        // Insert new commitments
        assert!(vector::length(&proof.output_commitments) == 2, EINVALID_PROOF);
        let commitment1 = *vector::borrow(&proof.output_commitments, 0);
        let commitment2 = *vector::borrow(&proof.output_commitments, 1);
        
        let next_index = merkle_tree::insert_pair(&mut pool.merkle_tree, commitment1, commitment2);
        
        event::emit(NewCommitment {
            commitment: commitment1,
            index: next_index,
            encrypted_output: ext_data.encrypted_output1,
        });
        
        event::emit(NewCommitment {
            commitment: commitment2,
            index: next_index + 1,
            encrypted_output: ext_data.encrypted_output2,
        });
    }

    // Calculate public amount from external amount and fee
    fun calculate_public_amount(ext_amount: u256, fee: u64): u256 {
        assert!((fee as u256) < MAX_FEE, EINVALID_FEE);
        assert!(ext_amount < MAX_EXT_AMOUNT, EINVALID_EXT_AMOUNT);
        
        let public_amount = if (ext_amount >= (fee as u256)) {
            ext_amount - (fee as u256)
        } else {
            FIELD_SIZE - ((fee as u256) - ext_amount)
        };
        
        public_amount
    }

    // Compute external data hash using proper cryptographic hash
    fun compute_ext_data_hash(ext_data: &ExtData): u256 {
        // Serialize all external data fields
        let hash_input = bcs::to_bytes(&ext_data.recipient);
        let ext_amount_bytes = bcs::to_bytes(&ext_data.ext_amount);
        let relayer_bytes = bcs::to_bytes(&ext_data.relayer);
        let fee_bytes = bcs::to_bytes(&ext_data.fee);
        
        vector::append(&mut hash_input, ext_amount_bytes);
        vector::append(&mut hash_input, relayer_bytes);
        vector::append(&mut hash_input, fee_bytes);
        vector::append(&mut hash_input, ext_data.encrypted_output1);
        vector::append(&mut hash_input, ext_data.encrypted_output2);
        
        // Use SHA3-256 and reduce modulo field size
        let hash_bytes = aptos_std::hash::sha3_256(hash_input);
        let result = bytes_to_u256(&hash_bytes);
        result % FIELD_SIZE
    }

    // Convert bytes to u256 (little-endian)
    fun bytes_to_u256(bytes: &vector<u8>): u256 {
        let result = 0u256;
        let i = 0;
        let len = vector::length(bytes);
        
        while (i < len && i < 32) {
            let byte_val = *vector::borrow(bytes, i);
            result = result + ((byte_val as u256) << ((8 * i) as u8));
            i = i + 1;
        };
        
        result
    }

    // Verify ZK proof - integrates with our groth16 verifier
    fun verify_proof(proof: &Proof): bool {
        let public_inputs = vector::empty<u256>();
        vector::push_back(&mut public_inputs, proof.root);
        vector::push_back(&mut public_inputs, proof.public_amount);
        vector::push_back(&mut public_inputs, proof.ext_data_hash);
        
        // Add nullifiers
        let i = 0;
        let nullifier_len = vector::length(&proof.input_nullifiers);
        while (i < nullifier_len) {
            vector::push_back(&mut public_inputs, *vector::borrow(&proof.input_nullifiers, i));
            i = i + 1;
        };
        
        // Add commitments
        let j = 0;
        let commitment_len = vector::length(&proof.output_commitments);
        while (j < commitment_len) {
            vector::push_back(&mut public_inputs, *vector::borrow(&proof.output_commitments, j));
            j = j + 1;
        };

        // Call the actual groth16 verifier
        groth16_verifier::verify_transaction_proof(
            proof.proof_a_x,
            proof.proof_a_y,
            proof.proof_b_x1,
            proof.proof_b_y1,
            proof.proof_b_x2,
            proof.proof_b_y2,
            proof.proof_c_x,
            proof.proof_c_y,
            public_inputs
        )
    }

    // Check if nullifier is spent
    #[view]
    public fun is_spent(nullifier_hash: u256): bool acquires ShieldedPool {
        let pool = borrow_global<ShieldedPool>(@shielded_pool);
        table::contains(&pool.nullifier_hashes, nullifier_hash)
    }

    // Get current merkle root
    #[view]
    public fun get_current_root(): u256 acquires ShieldedPool {
        let pool = borrow_global<ShieldedPool>(@shielded_pool);
        merkle_tree::get_last_root(&pool.merkle_tree)
    }

    // Admin function to configure limits
    public entry fun configure_limits(
        admin: &signer,
        maximum_deposit_amount: u64
    ) acquires ShieldedPool {
        let admin_addr = signer::address_of(admin);
        let pool = borrow_global_mut<ShieldedPool>(@shielded_pool);
        assert!(admin_addr == pool.admin, ENOT_AUTHORIZED);
        
        pool.maximum_deposit_amount = maximum_deposit_amount;
    }
}