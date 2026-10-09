# Signing pitfalls (ordered by how often they bite)

Each entry: symptom → cause → fix. API error bodies are `{"error": "...", "status": N}`.

The API checks in this order: headers present → timestamp window → signature against the sent `X-Pubkey` → credential lookup → active → rate limit → scope. So fix errors one at a time: an uncompressed key only shows up as "Invalid public key" once the signature itself verifies.

## 401 `Invalid signature: ...`

1. **Wrong curve.** Key used as secp256k1 (Ethereum/bitcoin libraries, `ethers`, `viem`, `secp256k1` npm). → Use P-256: Node `prime256v1`, WebCrypto `P-256`, Python `cryptography` `SECP256R1`, Go `elliptic.P256()`, `@noble/curves/p256`, `elliptic` `new EC("p256")`.
2. **Path without `/v1`.** Old doc samples sign `/submit/deposit`. → Sign the full path: `/v1/submit/...`, `/v1/query/...`.
3. **Query string missing or different.** You signed `/v1/query/x` but sent `/v1/query/x?chain_id=8453`, or your HTTP client re-encoded the query when it built the URL (clients differ on how they escape characters such as `:` `,` `@`). → Build the full `path?query` string yourself, sign it, and request that exact URL. Keep values URL-safe; the server compares the raw received string.
4. **Body bytes differ.** Signed `JSON.stringify(body)` but the client sent its own serialization (pretty-printed, different key order, `fetch(..., { body: obj })` without stringify). → Stringify once into `bodyStr`, sign `bodyStr`, send `bodyStr`.
5. **Body on GET.** GET signs an empty body. → Message ends right after the path.
6. **Double hashing.** You SHA-256 the message and then call a sign function that hashes again (`crypto.sign("sha256", hash)`, WebCrypto `sign` on a digest). → Hash exactly once: either pass the message to a hashing signer, or pass the digest to a prehashed signer (`elliptic.sign(digest)`, `p256.sign(digest)`).
7. **Lowercase method.** → `GET`, `POST`, `PATCH`, `DELETE`.

## 401 `Invalid public key`

- Signature verified but no credential matches. Causes: uncompressed `X-Pubkey` (`0x04…`, 65 bytes) → send compressed; key revoked/deleted; sandbox key used on production or the reverse (keys are per environment).

## 401 `Integrator or credential is not active`

- Credential or integrator deactivated. Check the dashboard Settings → API keys, or ask Byzantine.

## 401 `Stale signature. Timestamp outside tolerance`

- Timestamp older than 60 s or more than 10 s in the future. Milliseconds instead of seconds; stamp created long before sending (queues, retries reusing old headers); server clock drift. → Stamp immediately before each send, including retries.

## 400 `X-… header is required for this request`

- A header is missing or renamed by a proxy/CDN. Header names are case-insensitive.

## 400 `Failed to parse signature (tried DER and compact)`

- `X-Signature` is base64, or truncated. → `0x` + hex of the DER bytes (raw 64-byte r||s is also accepted).

## 403 `Read-only credentials cannot perform this action`

- The key is `read_only` and the request is not GET. Includes all `get-*-payload-passkey` POSTs. → Use a `read_write` key for that service, keep `read_only` elsewhere.

## 429 `Rate limit exceeded (50 requests per second)`

- Per integrator, all keys combined. No `Retry-After` header: back off ~1 s and re-stamp.

## Plain-text 400 / 415 / 422 (not JSON)

- The request passed auth but the body failed to deserialize (bad field name/type, missing `Content-Type: application/json`). Compare with the OpenAPI schema (`byzantine-api-generic` skill).
