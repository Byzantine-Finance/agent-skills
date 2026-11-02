---
name: byzantine-money-movement
description: Use when building or debugging Byzantine Finance deposits, withdrawals, account activation, stablecoin transfers, queued withdrawal cancellation or the Base→Ethereum vault upgrade - the get-*-payload-passkey endpoints, bodyToSign, transactionId, sign-payload-passkey, webAuthnStamp, passkey signing, fiatDepositInstructions, HTTP 202 withdrawal_initiated, "Unknown transaction ID", "Account is not delegating to Atlas", or transaction statuses.
license: Apache-2.0
metadata:
  version: "0.1.0"
---

# Byzantine money movement

**Byzantine and the integrator can build a transaction but can never sign one.** Every movement is signed by the end user's passkey, in the browser/app, at the moment of the action. Server code and AI agents prepare; the user signs.

Requires `byzantine-api-auth` for the integrator request signing (every call below is stamped) and a `read_write` key: `read_only` keys get 403 on every call below, including the `get-*-payload` POSTs.

## The two-step pattern

```
server:  POST /v1/query/get-<action>-payload-passkey?chain_id=…   → { bodyToSign, transactionId, … }
browser: client.webauthn.getStamp(JSON.stringify(bodyToSign))     → passkey prompt → stamp
server:  POST /v1/submit/sign-payload-passkey?chain_id=…           { signedBody: bodyToSign, transactionId, webAuthnStamp }
```

```ts
// browser (same rpId as the one used when the passkey was created)
const client = new ByzantineClient({ webauthn: { rpId: "app.example.com", rpName: "Example" } });
const { stampHeaderValue } = await client.webauthn.getStamp(JSON.stringify(bodyToSign)); // STRING, not the object
await fetch("/api/byzantine/sign", { method: "POST", body: JSON.stringify({ transactionId, bodyToSign, stamp: stampHeaderValue }) });

// server
const body = { signedBody: bodyToSign, transactionId, webAuthnStamp: stamp };
const path = `/v1/submit/sign-payload-passkey?chain_id=${chainId}`;
const s = await client.apiKey.getStamp("POST", path, JSON.stringify(body));
const { data, response } = await client.api.signPayloadPasskey(chainId, body, { pubkey: s["X-Pubkey"], timestamp: s["X-Timestamp"], signature: s["X-Signature"] });
if (response.status === 202) { /* queued withdrawal: status withdrawal_initiated, not done yet */ }
```

## Before any money action

Money moves only when the end user approves it with their passkey. As the assistant, never prepare, sign or submit a deposit, withdrawal, transfer or activation on your own initiative. First tell the user the amount, asset, chain and destination (or bank account) and wait for an explicit yes. Do not run these calls in a loop or in the background, and build and test in the sandbox before production.

## Rules that break integrations

1. **Pass `bodyToSign` through untouched.** The passkey signs `JSON.stringify(bodyToSign)` exactly as returned (same key order, no added/removed fields, same `timestampMs`). Send that same object back as `signedBody`.
2. **One unsigned draft per account, of any type.** A new `get-*-payload` call on the account silently invalidates the previous unsigned `transactionId` → 400 `"Unknown transaction ID"` when signing it. Prepare only when the user is about to sign; never prepare in a loop or in the background.
3. **Store the draft, but don't track it until signing succeeds.** Unsigned drafts are invisible (`get-transaction` → 404). Keep `bodyToSign` as the exact `JSON.stringify` string in a **text** column (a `jsonb` column reorders keys and breaks the stamp), and start polling only after `sign-payload-passkey` returns 200/202. If the sign call times out, reconcile with `get-transaction`: 200 = it went through, 404 = not signed.
4. **Activate once per chain before anything else.** `get-activate-account-payload-passkey?chain_id=1` and `?chain_id=8453` are separate. Check `get-account-details` → `walletDetails.isSmartAccount.{ethereum,base}`. Activation requires KYC/KYB `active`. Missing activation → 401 `"Account is not delegating to Atlas contract on chain_id …"`.
5. **Amounts are human decimal strings** in the asset or fiat unit: `"750.25"`, never base units, never floats. Must be > 0. Withdraw `amount` is in asset units, not shares.
6. **Currencies are lowercase:** `usd | eur | usdc | eurc`. `chain_id` is `1` (Ethereum) or `8453` (Base).
7. **`200` vs `202`.** 202 = withdrawal queued (`withdrawal_initiated`, `withdrawalRequest.status: pending`). It succeeded; it is not settled.
8. **`simulation_failed` / `reverted` can be re-signed** with the same `transactionId` and the same `bodyToSign` (new passkey prompt), unless another payload was prepared on the account since. A failed Turnkey/stamp check surfaces as 500 `"Turnkey API error …"`.
9. **WebAuthn needs a user gesture.** Call `getStamp` directly from a click handler (Safari drops the gesture after an `await` on the network): fetch the payload first, then show an "Approve with passkey" button.

## Endpoints and specifics

| Action | Body | Notes |
|---|---|---|
| Activate | `{accountId}` | Per chain. Response 200 `processing`; completes on receipt. |
| Deposit stablecoin | `{accountId, vaultAddr, amount, sourceCurrency: "usdc"\|"eurc"}` | Uses idle wallet balance. Sign returns `processing`, then `completed` on receipt. No balance check at prepare time: insufficient funds fail at sign (simulation). First deposit in a vault bundles the ERC-20 approve automatically. |
| Deposit fiat (on-ramp) | same, `sourceCurrency: "eur"\|"usd"` | Pairs: EUR→USDC, EUR→EURC, USD→USDC. Sign returns `waiting_for_funds` + `fiatDepositInstructions`. The user must wire **exactly** `fiatDepositInstructions.expectedDepositAmount` (= the `amount` prepared): the wire is matched to the deposit on the exact amount. A different amount is not matched: it is converted into the wallet as idle balance and the deposit stays `waiting_for_funds`. Allow one pending fiat deposit per amount. |
| Withdraw | `{accountId, vaultAddr, amount, destinationCurrency, bankAccountId?}` | `bankAccountId` required for `eur`/`usd` (off-ramp; add the bank account first, see `references/bank-accounts.md`). Over the max → 401 `"Withdrawal amount exceeds maximum allowed…"`. May return 202. |
| Cancel queued withdrawal | `{transactionId}` (of the withdrawal) | Only while `pending`. Sign within **5 minutes** (intent expiry). |
| Transfer | `{accountId, currency, amount, destinationAddress}` | Irreversible, to any address. Checks idle balance. Confirm the address with the user. |
| Vault upgrade (Base→Ethereum, EUR) | `{accountId, sourceVaultAddr}`, no `chain_id` on prepare | Needs both chains activated; > 1 EURC. `bodyToSign.parameters.payloads` has 2 entries (one prompt). Sign with `chain_id=8453`. |

Vaults: `GET /v1/query/top-vaults` (use only `is_active`). It has no currency/name field: identify the USDC vs EUR vault from existing positions (`get-account-balances` → `positions[].currency`, `asset_address`), the vault's ERC-4626 `asset()` on-chain, or your own config per environment. Assets: `GET /v1/query/assets`.

Withdraw all: read `get-account-balances?accountId=…&chainId=…` (camelCase `chainId` here) and withdraw the position `balance` (decimal string; yield keeps accruing, so a tiny remainder can stay). Positions already queued are reported under `pending_withdrawals`.

## Tracking

Statuses (`get-transaction`, `get-all-transactions`): `processing → completed`; fiat: `waiting_for_funds → funds_in_transfer → funds_received → processing → completed` (or `refunded`); off-ramp: `processing → waiting_for_funds → funds_received → completed`; queued: `withdrawal_initiated → processing → completed` or `cancelled`; failures `simulation_failed`, `reverted`. Terminal: `completed`, `refunded`, `cancelled`.

Poll `get-transaction` after signing, or subscribe to `transaction.*` webhooks (one per status transition; status in `data.transaction.status`, see `byzantine-webhooks`).

## Testing in sandbox without a frontend

`npx -p @byzantine/integrator-sdk@1.15.0 byz-passkey-tool` opens a local page (rpId `localhost`) to enroll a passkey and sign a `bodyToSign` by hand. KYC/KYB auto-approves in sandbox; no fiat moves (on-ramp flows stay at `waiting_for_funds`) and no payment webhooks are sent.

Doc pages that are out of date: `/submit/send-transaction-passkey` and WebAuthn stamps sent as headers (use `sign-payload-passkey` with `webAuthnStamp` in the body); "activate per vault" (it is per chain); `getStamp(payload)` with an object (it takes a string).

## For AI agents acting on a user's behalf

Prepare, show the user what will happen (action, amount, currency, vault/destination, chain), then hand off to the app where the user signs with their passkey. Never call `sign-payload-passkey` with a stamp you produced or obtained outside the user's own device, and never store passkey stamps.
