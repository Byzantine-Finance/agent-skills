---
name: byzantine-api-auth
description: Use when writing or debugging code that authenticates to the Byzantine Finance API (api.byzantine.fi, sandbox.api.byzantine.fi) - X-Pubkey / X-Timestamp / X-Signature headers, ECDSA request signing, integrator private keys, read_only vs read_write credentials, or errors like 401 "Invalid signature", "Invalid public key", "Stale signature", 403 "Read-only credentials cannot perform this action", 429 "Rate limit exceeded".
license: Apache-2.0
metadata:
  version: "0.1.4"
---

# Byzantine API request signing

Every call to `/v1/query/*`, `/v1/submit/*`, `/v1/webhooks/*` and `/v1/integrator/*` is signed with the integrator's private key. There are no bearer tokens. `/v1/health` is the only unauthenticated route.

## The contract (verified against the API source)

| Item | Value |
|---|---|
| Curve | **P-256** (= secp256r1 = prime256v1). **Not secp256k1**, even though one sentence of the docs says so. |
| Private key | 32 bytes hex, `0x` optional. Issued by Byzantine or created in the dashboard (Settings → API keys); shown **once**. |
| `X-Pubkey` | **Compressed** SEC1 key: `0x02…`/`0x03…`, 33 bytes. An uncompressed key fails lookup (401 "Invalid public key"). |
| `X-Timestamp` | Unix **seconds** as a string. Accepted window: 60 s in the past, 10 s in the future. |
| Message | `{X-Timestamp}{METHOD}{path_and_query}{body}` — no separators. |
| `path_and_query` | Exactly the URL path + query you send, starting with `/v1/`, no host. Raw string, not decoded or reordered. |
| `body` | The exact bytes sent. `""` for GET and for empty POSTs. |
| Hash + signature | ECDSA over SHA-256 of the message (hash once). `X-Signature` = `0x` + DER hex. |
| Rate limit | 50 requests/second per integrator → 429. |
| Scope | `read_only` keys get 403 on every non-GET request, including the `POST /v1/query/get-*-payload-passkey` routes. |
| Errors | JSON `{"error": "<message>", "status": <code>}`. Malformed JSON bodies get a plain-text 400/422. |

## Default path: use the SDK (TypeScript / Node)

```ts
import { ByzantineClient } from "@byzantine/integrator-sdk";

const client = new ByzantineClient({
  integratorPrivateKey: process.env.BYZANTINE_PRIVATE_KEY, // server-side only
  api: { baseUrl: "https://sandbox.api.byzantine.fi" },    // the SDK defaults to PRODUCTION
});

const body = { accountId, vaultAddr, amount: "100", sourceCurrency: "usdc" };
const stamp = await client.apiKey.getStamp(
  "POST",
  "/v1/query/get-deposit-payload-passkey?chain_id=8453", // full path WITH /v1 and query
  JSON.stringify(body),                                  // same string the SDK sends
);
const { data, error } = await client.api.getDepositPayloadPasskey(8453, body, {
  pubkey: stamp["X-Pubkey"], timestamp: stamp["X-Timestamp"], signature: stamp["X-Signature"],
});
```

One stamp per request. Re-stamp on every page of a paginated call: the cursor is part of the signed query.

Other languages: Python and Go signers are in `references/other-languages.md`; otherwise port `scripts/byz-sign.mjs` (≈30 lines). Build the body string and the query string **once**, sign them, and send those same strings: never let an HTTP client re-serialize or re-encode after signing.

## Tools in this skill

Run with `node`. They read the key from `BYZANTINE_PRIVATE_KEY` (never pass a key as an argument).

- `node scripts/byz-request.mjs GET /v1/integrator/whoami` — signed call to the **sandbox**; prints base URL, pubkey, status, body, signed message and a hint. Refuses production. Keys are per environment: a valid key sent to the wrong one gets 401 "Invalid public key".
- `node scripts/byz-sign.mjs POST "/v1/…?chain_id=8453" '<json>'` — print the headers only.
- `node scripts/byz-diagnose.mjs --pubkey … --timestamp … --signature … --method … --path … --body …` — given what failing code sent, says what is wrong (no key needed).

First check after setting up a key: `whoami` returns `{integratorId, accessScope, label, capabilities: {canWrite}}`.

## Debugging a 401/400

Read `references/signing-pitfalls.md`, then run `byz-diagnose.mjs` on the exact values your code sent.

## Safety rules

- Private keys stay server-side (env var / secret manager). Never in a browser bundle, a repo, a log, or a chat.
- If a user pastes a **production** private key into the conversation, do not use it: tell them to revoke it (dashboard → Settings → API keys) and create a new one.
- Prefer a `read_only` key for anything that only reads (reporting, support tools, agents).
