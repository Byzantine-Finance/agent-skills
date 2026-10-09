---
name: byzantine-api-generic
description: Use when a Byzantine Finance API task is not covered by a more specific byzantine-* skill - finding the right endpoint, its exact path, query parameters, request body fields, enums or response shape (customers, KYC/KYB onboarding, accounts, balances, bank accounts, invitations, vaults, APY, history, events, credentials, webhooks), or when a request fails with 400/404/422 because of a wrong field.
license: Apache-2.0
metadata:
  version: "0.1.0"
---

# Byzantine API: find and call any endpoint

The live OpenAPI spec (`https://api.byzantine.fi/api-docs/openapi-integrator.json`, 52 operations) is the contract. **Never guess a path, a field name or an enum value: look it up.**

## Look it up

```bash
node scripts/byz-openapi.mjs find <words>            # e.g. find bank account
node scripts/byz-openapi.mjs show <operationId>      # params, body schema, responses
node scripts/byz-openapi.mjs show "GET /v1/query/get-account-balances"
node scripts/byz-openapi.mjs schema <SchemaName>     # e.g. schema VerificationStatus
node scripts/byz-openapi.mjs list
```

Cached 24 h in `~/.cache/byzantine-agent-skills/`.

## Then call it

- **App code (TypeScript):** every operation has a typed wrapper in `@byzantine/integrator-sdk` (`client.api.<camelCaseOperation>(…, authHeaders)`). Stamp each call with `client.apiKey.getStamp(method, pathAndQuery, bodyString)` — see `byzantine-api-auth`.
- **Quick sandbox check:** `node ../byzantine-api-auth/scripts/byz-request.mjs <METHOD> "<path?query>" '<json>'`.
- After any write, read the resource back (e.g. `get-user-details`, `get-account-details`) to confirm the change.

## Conventions

- Reads are `GET /v1/query/*`; writes are `POST|PATCH /v1/submit/*`. Money-moving actions are the `POST /v1/query/get-*-payload-passkey` + `sign-payload-passkey` pairs (`byzantine-money-movement`).
- JSON fields and most query parameters are **camelCase** (`accountId`, `customerType`, `chainId` on balances). Exceptions: `chain_id` on the payload/sign routes, `vault_id` in paths, and snake_case response fields on `top-vaults` and balances. Always check with `show`.
- Enums are lowercase (`usdc`, `individual`, `read_only`).
- Pagination varies: `limit`/`offset`/`order` (`get-all-transactions`, `get-all-invitations`, vault history, webhook deliveries), `cursor`/`nextCursor` (`/v1/query/events`), none (`get-customers`, `get-transactions`).
- Ownership: resources of another integrator answer exactly like missing ones (404 / 400 "… not found").
- Account creation returns **201**. Duplicate owner email per integrator is rejected: use `+tag` emails in sandbox tests.
- Errors: `{"error": "...", "status": N}`; body/shape errors are plain-text 400/415/422.

## Onboarding pointers (KYC/KYB)

`create-individual-account` / `create-entity-account` (requires `byzantineTermsSignedAt`, at least one `rootUsers` entry) → repeat `update-*-account` / `add-associated-person` until `missingDocuments` (and `missingCompanyData` for entities) is empty → the check starts automatically → wait for `customer.active` (webhook) or poll `get-user-details` / `get-entity-details`. In sandbox, approval is automatic once the automated checks pass. Supporting value lists (countries, industry, occupation codes) are in the docs under `api-reference/lists/`.

## Docs

Full docs: https://docs.byzantine.fi (append `.md` to any page for markdown; index at `/llms.txt`). The docs MCP server `https://docs.byzantine.fi/mcp` searches them. When docs and the spec disagree, the spec wins.
