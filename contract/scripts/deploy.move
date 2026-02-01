script {
    use aptos_framework::fungible_asset;
    use aptos_framework::object;
    use shielded_pool::pool;

    /// Deploy and initialize the Tornado Nova pool with proper resource account
    /// This script should be run by the admin account
    fun deploy_tornado_pool(admin: &signer) {
        // For testnet, we'll use APT as the token
        // APT metadata address on testnet: 0x000000000000000000000000000000000000000000000000000000000000000a
        let apt_metadata = object::address_to_object<fungible_asset::Metadata>(@0x000000000000000000000000000000000000000000000000000000000000000a);
        
        // Initialize with:
        // - 20 levels for merkle tree (supports 2^20 = ~1M commitments)
        // - 1000 APT maximum deposit (1000 * 10^8 octas)
        // This will create a resource account automatically
        pool::initialize(
            admin,
            20,
            100000000000, // 1000 APT in octas
            apt_metadata
        );
    }
}