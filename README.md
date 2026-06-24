# Gonka Bridge (gonkascan-bridge)

Standalone re-implementation of the Gonka Exchange & Bridge widget, deployed at
**bridge.gonkascan.com**. Bridges USDC/USDT between Sepolia (Ethereum) and the
Gonka network using validator BLS threshold signatures.

This is a write/funds dapp and lives in its own repo, deliberately separate from
the read-only gonkascan.com explorer.

## Stack

- Vite + React + TypeScript
- ethers v6 (EVM) · @cosmjs (Cosmos/CW20) · injected MetaMask + Keplr
- No BLS curve library — the Gonka orchestrator returns EIP-2537 *uncompressed*
  bytes, so the client only does base64→hex.

## Setup

```bash
cp .env.example .env   # adjust RPC if desired
npm install
npm run dev            # http://localhost:5174
npm run build          # typecheck + production build
```

## Config

All chain constants live in [`src/config/chains.ts`](src/config/chains.ts),
probe-verified against the live testnet. Key facts:

- Gonka testnet host `89.169.111.79:8000` (chain RPC + REST + `/v1/bls` orchestrator)
- Gonka SLIP-44 coin type is **1200** (non-standard) — root of the address-mismatch guard
- Sepolia bridge `0x8395733B8ecc2d1d3A7eb1b8B921d71EE4620b02` (= WGNK, NORMAL_OPERATION)
- USDC/USDT decimals are 6 on **both** sides — amounts map 1:1, no scaling
- `bridge_addresses` registry is keyed on the string `"sepolia"`, not `11155111`

## Fund-loss guards (hard-gated)

1. **Address mismatch** — EVM address derived from the Keplr pubkey must equal the
   active MetaMask address (coin type 1200 ≠ 60). See `src/lib/addressGuard.ts`.
2. **Epoch out of sync** — the bridge contract may lag the current Gonka epoch;
   withdraw must submit the missing epochs first. See `src/hooks/useBridgeStatus.ts`.
3. **request_id integrity** — base64 → 32-byte hex only, never re-hashed. See
   `src/lib/requestId.ts`.

## Status

- [x] Phase 1 — scaffold, dual-wallet connect, address guard, read-only status panel
- [ ] Phase 2 — USDC/USDT deposit (Sepolia → Gonka)
- [ ] Phase 3 — USDC/USDT withdraw (Gonka → Sepolia) incl. epoch catch-up + resume
- [ ] Phase 4 — polish + Docker/nginx deploy
