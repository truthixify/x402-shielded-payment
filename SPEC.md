# x402 Shielded Payments

## 1. Overview

This document specifies an extension to the x402 (HTTP 402 Payment Required) payment flow that enables **payer address privacy** using a Tornado Nova–style shielded pool.

The goal is to preserve the **existing x402 semantics** while ensuring that:

* The server receives payment normally
* The payment amount remains public
* The payer’s on-chain address is never revealed to the server
* Payments are unlinkable across requests

This is achieved by replacing direct EOA-to-server transfers with **shielded transfers** settled on-chain, optionally broadcast via a relayer ("facilitator").

---

## 2. Design Goals

* Preserve existing x402 flow and mental model
* Hide user wallet address from servers
* Allow variable payment amounts
* Support prepaid balances and pay-as-you-go usage
* Avoid introducing new trust assumptions
* Rely on on-chain verification for correctness

Non-goals:

* Hiding payment amounts
* Hiding server revenue
* Preventing network-level correlation (IP, timing)

---

## 3. System Components

### 3.1 Client

* Holds a shielded balance in a shielded pool
* Generates shielded transfer transactions
* Binds payments to specific x402 requests

### 3.2 x402 Server (Merchant)

* Exposes priced HTTP resources
* Publishes a shielded receiving public key
* Verifies on-chain payment settlement
* Serves content upon successful payment

### 3.3 Shielded Pool Contract 

* Maintains shielded balances via commitments
* Verifies zero-knowledge proofs for transfers
* Enforces nullifier uniqueness
* Emits transfer events on successful settlement

### 3.4 Facilitator (Relayer / Broadcaster)

* Broadcasts pre-signed shielded transfer transactions
* Does not modify or validate transaction contents
* Does not require trust for correctness

The facilitator is optional; users MAY broadcast transactions themselves.

---

## 4. High-Level Flow

1. User pre-deposits funds into the shielded pool
2. Server responds with `402 Payment Required`
3. Client constructs a shielded transfer to the server
4. Facilitator broadcasts the transaction
5. Pool contract verifies and settles the transfer
6. Client retries request with transaction reference
7. Server verifies settlement and serves content

---

## 5. Pre-Funding (Out of Band)

Before interacting with x402-protected endpoints, a user deposits funds into the shielded pool:

* Deposit amount is public
* Deposit address is unlinkable from future payments
* Deposits may be made at any time

This step is independent of x402.

---

## 6. x402 Challenge Response

When a client requests a protected resource, the server responds:

```
HTTP/1.1 402 Payment Required
X-Price: <amount>
X-Payment-Contract: <nova_pool_address>
X-Payment-Recipient: <server_shielded_pubkey>
X-Request-Nonce: <nonce>
```

Notes:

* Pricing is transparent
* The shielded public key identifies the server as the recipient
* The nonce uniquely binds the payment to this request

---

## 7. Shielded Transfer Construction

The client constructs a shielded transfer with:

### Public Parameters

* Recipient shielded public key
* Transfer amount
* Memo hash

### Memo Binding

To prevent replay, resale, or cross-endpoint reuse, the memo MUST be:

```
memo = H(server_domain || resource_path || request_nonce)
```

### Circuit Enforcement

The shielded transfer circuit enforces:

* Ownership of sufficient balance
* Correct amount transfer
* Nullifier uniqueness
* Valid change commitment

---

## 8. Transaction Broadcasting

The shielded transfer transaction is:

* Fully constructed and signed by the client
* Broadcast to the blockchain either by:

  * The client directly, or
  * A facilitator (relayer)

The facilitator:

* Cannot modify transaction contents
* Cannot forge or fake payments
* Acts only as a broadcaster

---

## 9. On-Chain Settlement

Upon inclusion:

* The pool contract verifies the ZK proof
* The nullifier is permanently marked as spent
* The server’s shielded balance is credited
* A transfer event is emitted

Example event fields:

* Recipient shielded key
* Amount
* Memo hash
* Nullifier

The blockchain is the sole source of truth.

---

## 10. Proof of Payment (Retry Request)

After transaction confirmation, the client retries the original request with:

```
X-Payment-Tx: <transaction_hash>
```

This matches existing x402 semantics.

---

## 11. Server Verification

The server verifies:

1. Transaction exists and succeeded
2. Transaction interacted with the expected pool contract
3. Transfer event fields match:

   * Recipient = server shielded key
   * Amount = advertised price
   * Memo hash = expected request binding
4. Confirmation depth meets policy

No zero-knowledge verification is performed by the server.

---

## 12. Privacy Properties

This design guarantees:

* The server never learns the user’s wallet address
* Payments are unlinkable across requests
* Deposits cannot be linked to payments

It does not protect against:

* Timing correlation
* Network-layer metadata leakage

---

## 13. Trust Model

* Correctness is enforced entirely on-chain
* The facilitator cannot lie about payment validity
* The server does not need to trust the facilitator
* Availability (liveness) is the only facilitator dependency

---

## 14. Compatibility and Deployment

* Fully compatible with existing x402 flows
* Requires no changes to HTTP semantics
* Can be deployed incrementally
* Suitable for L1 or L2 environments

---

## 15. Summary

This specification defines a minimal, trustless extension to x402 that provides payer address privacy using shielded transfers.

The only functional change is the substitution of direct payments with shielded on-chain settlement, preserving all existing x402 guarantees while significantly improving user privacy.
