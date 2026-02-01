module shielded_pool::groth16_verifier {
    use aptos_std::crypto_algebra::{Element, from_u64, multi_scalar_mul, eq, pairing, add, zero};
    use aptos_std::crypto_algebra::{deserialize};
    use aptos_std::bn254_algebra;
    use std::bcs;
    use std::vector;

    /// Error codes
    /// Invalid proof verification
    const EINVALID_PROOF: u64 = 1;

    public fun verify_proof<G1,G2,Gt,S>(
        vk_alpha_g1: &Element<G1>,
        vk_beta_g2: &Element<G2>,
        vk_gamma_g2: &Element<G2>,
        vk_delta_g2: &Element<G2>,
        vk_uvw_gamma_g1: &vector<Element<G1>>,
        public_inputs: &vector<Element<S>>,
        proof_a: &Element<G1>,
        proof_b: &Element<G2>,
        proof_c: &Element<G1>,
    ): bool {
        let left = pairing<G1,G2,Gt>(proof_a, proof_b);
        let scalars = vector[from_u64<S>(1)];
        std::vector::append(&mut scalars, *public_inputs);
        let right = zero<Gt>();
        let right = add(&right, &pairing<G1,G2,Gt>(vk_alpha_g1, vk_beta_g2));
        let right = add(&right, &pairing(&multi_scalar_mul(vk_uvw_gamma_g1, &scalars), vk_gamma_g2));
        let right = add(&right, &pairing(proof_c, vk_delta_g2));
        eq(&left, &right)
    }

    public fun verify_transaction_proof(
        a_x: u256, a_y: u256,
        b_x1: u256, b_y1: u256, b_x2: u256, b_y2: u256,
        c_x: u256, c_y: u256,
        public_inputs_raw: vector<u256>
    ): bool {
        let a_bytes = bcs::to_bytes<u256>(&a_x);
        let a_y_bytes = bcs::to_bytes<u256>(&a_y);
        vector::append(&mut a_bytes, a_y_bytes);
        let a = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&a_bytes));

        let b_bytes = bcs::to_bytes<u256>(&b_x1);
        let b_y1_bytes = bcs::to_bytes<u256>(&b_y1);
        let b_x2_bytes = bcs::to_bytes<u256>(&b_x2);
        let b_y2_bytes = bcs::to_bytes<u256>(&b_y2);
        vector::append(&mut b_bytes, b_y1_bytes);
        vector::append(&mut b_bytes, b_x2_bytes);
        vector::append(&mut b_bytes, b_y2_bytes);
        let b = std::option::extract(&mut deserialize<bn254_algebra::G2, bn254_algebra::FormatG2Uncompr>(&b_bytes));

        let c_bytes = bcs::to_bytes<u256>(&c_x);
        let c_y_bytes = bcs::to_bytes<u256>(&c_y);
        vector::append(&mut c_bytes, c_y_bytes);
        let c = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&c_bytes));

        let public_inputs = vector::empty<Element<bn254_algebra::Fr>>();
        let len = vector::length(&public_inputs_raw);
        let i = 0;
        while (i < len) {
            let val = vector::borrow(&public_inputs_raw, i);
            let bytes = bcs::to_bytes<u256>(val);
            let fr = std::option::extract(&mut deserialize<bn254_algebra::Fr, bn254_algebra::FormatFrLsb>(&bytes));
            vector::push_back(&mut public_inputs, fr);
            i = i + 1;
        };

        // Verification key constants for transaction2.circom
        let vk_alpha_x = 20491192805390485299153009773594534940189261866228447918068658471970481763042u256;
        let vk_alpha_y = 9383485363053290200918347156157836566562967994039712273449902621266178545958u256;
        let vk_alpha_bytes = bcs::to_bytes<u256>(&vk_alpha_x);
        let vk_alpha_y_bytes = bcs::to_bytes<u256>(&vk_alpha_y);
        vector::append(&mut vk_alpha_bytes, vk_alpha_y_bytes);
        let vk_alpha = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_alpha_bytes));

        let vk_beta_x1 = 6375614351688725206403948262868962793625744043794305715222011528459656738731u256;
        let vk_beta_y1 = 4252822878758300859123897981450591353533073413197771768651442665752259397132u256;
        let vk_beta_x2 = 10505242626370262277552901082094356697409835680220590971873171140371331206856u256;
        let vk_beta_y2 = 21847035105528745403288232691147584728191162732299865338377159692350059136679u256;
        let vk_beta_bytes = bcs::to_bytes<u256>(&vk_beta_x1);
        let vk_beta_y1_bytes = bcs::to_bytes<u256>(&vk_beta_y1);
        let vk_beta_x2_bytes = bcs::to_bytes<u256>(&vk_beta_x2);
        let vk_beta_y2_bytes = bcs::to_bytes<u256>(&vk_beta_y2);
        vector::append(&mut vk_beta_bytes, vk_beta_y1_bytes);
        vector::append(&mut vk_beta_bytes, vk_beta_x2_bytes);
        vector::append(&mut vk_beta_bytes, vk_beta_y2_bytes);
        let vk_beta = std::option::extract(&mut deserialize<bn254_algebra::G2, bn254_algebra::FormatG2Uncompr>(&vk_beta_bytes));

        let vk_gamma_x1 = 10857046999023057135944570762232829481370756359578518086990519993285655852781u256;
        let vk_gamma_y1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634u256;
        let vk_gamma_x2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930u256;
        let vk_gamma_y2 = 4082367875863433681332203403145435568316851327593401208105741076214120093531u256;
        let vk_gamma_bytes = bcs::to_bytes<u256>(&vk_gamma_x1);
        let vk_gamma_y1_bytes = bcs::to_bytes<u256>(&vk_gamma_y1);
        let vk_gamma_x2_bytes = bcs::to_bytes<u256>(&vk_gamma_x2);
        let vk_gamma_y2_bytes = bcs::to_bytes<u256>(&vk_gamma_y2);
        vector::append(&mut vk_gamma_bytes, vk_gamma_y1_bytes);
        vector::append(&mut vk_gamma_bytes, vk_gamma_x2_bytes);
        vector::append(&mut vk_gamma_bytes, vk_gamma_y2_bytes);
        let vk_gamma = std::option::extract(&mut deserialize<bn254_algebra::G2, bn254_algebra::FormatG2Uncompr>(&vk_gamma_bytes));

        let vk_delta = std::option::extract(&mut deserialize<bn254_algebra::G2, bn254_algebra::FormatG2Uncompr>(&vk_gamma_bytes));

        let vk_gamma_abc_0_x = 246523424908210738606200684479511366301324947672936652734702135160807979006u256;
        let vk_gamma_abc_0_y = 21083058191111187463937087166994955926003879431664409726271476020909293601463u256;
        let vk_gamma_abc_0_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_0_x);
        let vk_gamma_abc_0_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_0_y);
        vector::append(&mut vk_gamma_abc_0_bytes, vk_gamma_abc_0_y_bytes);
        let vk_gamma_abc_0 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_0_bytes));

        let vk_gamma_abc_1_x = 12671261110974689921593700870941791075097169463791201220949355875147232007454u256;
        let vk_gamma_abc_1_y = 10873817147932456189631055813997578584799984832263555464068109061185961824166u256;
        let vk_gamma_abc_1_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_1_x);
        let vk_gamma_abc_1_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_1_y);
        vector::append(&mut vk_gamma_abc_1_bytes, vk_gamma_abc_1_y_bytes);
        let vk_gamma_abc_1 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_1_bytes));

        let vk_gamma_abc_2_x = 20346361901044327932621097425157442791155079458703963755192144706626726966855u256;
        let vk_gamma_abc_2_y = 18632151021057333304287771885300228701612647076388173672228011622783345461718u256;
        let vk_gamma_abc_2_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_2_x);
        let vk_gamma_abc_2_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_2_y);
        vector::append(&mut vk_gamma_abc_2_bytes, vk_gamma_abc_2_y_bytes);
        let vk_gamma_abc_2 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_2_bytes));

        let vk_gamma_abc_3_x = 21793836307727855506129768789248751437578911696939085794576522135894422008895u256;
        let vk_gamma_abc_3_y = 3952049312103618186268383350706006445335291964121268510162399791178653893290u256;
        let vk_gamma_abc_3_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_3_x);
        let vk_gamma_abc_3_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_3_y);
        vector::append(&mut vk_gamma_abc_3_bytes, vk_gamma_abc_3_y_bytes);
        let vk_gamma_abc_3 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_3_bytes));

        let vk_gamma_abc_4_x = 11948273859440388029925579105603743416532887978933130909750257822285994922623u256;
        let vk_gamma_abc_4_y = 17980220368584112707913545832048437019953591138153808140596409193510863277325u256;
        let vk_gamma_abc_4_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_4_x);
        let vk_gamma_abc_4_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_4_y);
        vector::append(&mut vk_gamma_abc_4_bytes, vk_gamma_abc_4_y_bytes);
        let vk_gamma_abc_4 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_4_bytes));

        let vk_gamma_abc_5_x = 19515060098559799436222519521937293559871600910970988842244305853361921130428u256;
        let vk_gamma_abc_5_y = 9547888024739601504955508814586711171901984988200390183023894094308010955466u256;
        let vk_gamma_abc_5_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_5_x);
        let vk_gamma_abc_5_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_5_y);
        vector::append(&mut vk_gamma_abc_5_bytes, vk_gamma_abc_5_y_bytes);
        let vk_gamma_abc_5 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_5_bytes));

        let vk_gamma_abc_6_x = 5359071365223373713690717579821059335119283009493931801949353524493872192003u256;
        let vk_gamma_abc_6_y = 7781581729382107214615447122856205482551951772552143351682323790146303656874u256;
        let vk_gamma_abc_6_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_6_x);
        let vk_gamma_abc_6_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_6_y);
        vector::append(&mut vk_gamma_abc_6_bytes, vk_gamma_abc_6_y_bytes);
        let vk_gamma_abc_6 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_6_bytes));

        let vk_gamma_abc_7_x = 5506867921087286212716335403583072253991837657816241689793407413844147178190u256;
        let vk_gamma_abc_7_y = 21454004397698987087254075132170958741928132381944728455031680111704965988746u256;
        let vk_gamma_abc_7_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_7_x);
        let vk_gamma_abc_7_y_bytes = bcs::to_bytes<u256>(&vk_gamma_abc_7_y);
        vector::append(&mut vk_gamma_abc_7_bytes, vk_gamma_abc_7_y_bytes);
        let vk_gamma_abc_7 = std::option::extract(&mut deserialize<bn254_algebra::G1, bn254_algebra::FormatG1Uncompr>(&vk_gamma_abc_7_bytes));

        let vk_gamma_abc = vector[vk_gamma_abc_0, vk_gamma_abc_1, vk_gamma_abc_2, vk_gamma_abc_3, vk_gamma_abc_4, vk_gamma_abc_5, vk_gamma_abc_6, vk_gamma_abc_7];

        verify_proof<bn254_algebra::G1, bn254_algebra::G2, bn254_algebra::Gt, bn254_algebra::Fr>(
            &vk_alpha, &vk_beta, &vk_gamma, &vk_delta, &vk_gamma_abc, &public_inputs, &a, &b, &c
        )
    }

    // Entry function for external verification calls
    public entry fun verify_and_assert(
        a_x: u256, a_y: u256,
        b_x1: u256, b_y1: u256, b_x2: u256, b_y2: u256,
        c_x: u256, c_y: u256,
        public_inputs_raw: vector<u256>
    ) {
        assert!(verify_transaction_proof(a_x, a_y, b_x1, b_y1, b_x2, b_y2, c_x, c_y, public_inputs_raw), EINVALID_PROOF);
    }
}