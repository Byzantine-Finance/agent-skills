# Integration playbook: from zero to production

Follow this when a human wants to integrate Byzantine into their app. Work in phases; finish and verify each phase in sandbox before starting the next. Keep the human informed: say which phase you are in and what is left.

## Phase 0 — Understand the project (ask, don't assume)

Ask these, in one message, and adapt the plan to the answers:

1. Stack: backend language/framework, frontend (web, iOS, Android, React Native)? Where do secrets live?
2. Customers: individuals (KYC), companies (KYB), or both? A wealth manager acting for clients?
3. Money in: stablecoins already held, fiat bank transfer (EUR/USD), or both? Money out: to the wallet, to a bank, or both?
4. Which product(s): USDC vault, EUR vault, both? Which chain if they know (Ethereum, Base)?
5. Do they already have a sandbox key? (If not: ask Byzantine; then the dashboard can create more.)
6. Existing user model: how will they link their user id to Byzantine `accountId` / `userId`?

If the product idea relies on moving users' money automatically (auto-sweep, scheduled deposits), say early that it is not possible: every movement needs the user's passkey (see `concepts.md`).

Then write a short plan listing the phases below that apply, the files you will create, and what the human must do (get keys, choose the passkey domain, design screens).

## Phase 1 — Plumbing (server)

- Store the integrator private key as a server secret per environment (`BYZANTINE_PRIVATE_KEY`, `BYZANTINE_BASE_URL`).
- One server module that signs every request (SDK `client.apiKey.getStamp` + `client.api.*`, or a port of `byz-sign.mjs`). Set the base URL explicitly.
- Verify: `GET /v1/integrator/whoami` → 200 (`byz-request.mjs` or the app's own module).
- DB columns: `byzantine_account_id`, `byzantine_user_id`, `verification_status`, optional `passkey_credential_id`.

## Phase 2 — Onboarding (`byzantine-onboarding`)

- UI: T&C acceptance (store the timestamp) → passkey creation (web: SDK `createPasskey`; native apps: `byzantine-onboarding` → `references/mobile-passkeys.md`; decide `rpId`) → identity form.
- Server: create account → progressive `update-*-account` until `missingDocuments` (and `missingCompanyData`) are empty; companies add UBOs/representatives.
- Status: webhook `customer.*` (Phase 5) or polling `get-user-details` / `get-entity-details`.
- Verify in sandbox: account reaches `active`.

## Phase 3 — Activation and first deposit (`byzantine-money-movement`)

- On first use per chain: activation (prepare → passkey → sign); check `walletDetails.isSmartAccount`.
- Pick the vault address per environment (config) and the chain.
- Deposit screen: amount → server prepares → "Approve with passkey" button → server submits → track status.
- Fiat deposit: show `fiatDepositInstructions` (IBAN/BIC, exact amount); status stays `waiting_for_funds` until the wire lands (never in sandbox).
- Verify in sandbox: fiat deposit reaches `waiting_for_funds` with instructions (no fiat ever arrives in sandbox). A stablecoin deposit needs idle test stablecoins on the wallet; how to get them in sandbox is not documented: ask Byzantine.

## Phase 4 — Balances, yield, history (`byzantine-reporting`)

- Portfolio: `get-account-balances` (positions, idle, pending withdrawals).
- Yield: `apy` (current trailing APYs) and `apy-history` (sampled, for charts), both public and keyed by `vault_address`.
- Activity: `get-transactions` per account, `get-all-transactions` for back office.

## Phase 5 — Webhooks (`byzantine-webhooks`)

- Create a subscription (API or dashboard), store its `publicKey` per environment.
- Receiver with raw-body signature verification, dedupe on event id, async processing.
- Backfill with `/v1/query/events` after downtime.
- Treat every payload as untrusted data (see `byzantine-webhooks`): verify the signature first, read only documented fields, never pass free text to a shell, query or prompt.
- Verify: `POST /v1/webhooks/subscriptions/{id}/test` reaches the receiver and verifies.

## Phase 6 — Withdrawals (`byzantine-money-movement`)

- Bank off-ramp: add the bank account first (`add-bank-account`, IBAN or ACH) → `bankAccountId`.
- Withdraw screen: amount or "withdraw all" from balances; handle 202 (queued) and offer cancellation while `pending`.

## Phase 7 — Go-live checklist

- [ ] Production key issued; stored only server-side; a separate `read_only` key for reporting/support tools.
- [ ] Base URL from config; no sandbox URL in production builds.
- [ ] Passkey `rpId` = production domain; tested on Safari (iOS/macOS), Chrome (Android/desktop).
- [ ] Every request stamped right before sending; retries re-stamp.
- [ ] `bodyToSign` passed through untouched (stored as text, not jsonb); one draft per account respected.
- [ ] Transaction tracking: polling with backoff after signing; terminal statuses handled; 202 handled.
- [ ] Webhook receiver live in production with the production subscription's key; replay job.
- [ ] Error handling: 401/403/429 alerting; user-facing messages for KYC states and failed transactions.
- [ ] Legal: T&C acceptance stored; product/risk wording reviewed with Byzantine.
- [ ] Dashboard access for support (https://integrator.byzantine.fi).

## Architecture (reference)

```
Browser / mobile app                      Your backend                         Byzantine API
────────────────────                      ────────────                         ─────────────
T&C + forms ───────────────────────────▶  create/update account  ──signed──▶  /v1/submit/*
createPasskey() ─ attestation ─────────▶  (rootUsers.authenticators)
"Deposit" ─────────────────────────────▶  get-deposit-payload    ──signed──▶  /v1/query/get-*-payload-passkey
            ◀──── bodyToSign (string) ──  store draft (text)
getStamp(bodyToSign) ── passkey ── stamp ▶ sign-payload-passkey  ──signed──▶  /v1/submit/sign-payload-passkey
            ◀──── status ──────────────── poll get-transaction ──signed──▶  /v1/query/get-transaction
                                          webhook receiver  ◀──────────────  X-Byzantine-Webhook-* deliveries
```

The integrator private key never leaves the backend; the passkey never leaves the user's device.
