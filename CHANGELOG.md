# Changelog

## 0.1.1

Security audit follow-up and accuracy fixes.

- `byzantine-api-generic`: the OpenAPI spec is bundled as a snapshot (`references/openapi-integrator.json`); nothing is downloaded or cached by default, `--live` fetches the public spec on demand. Maintainers refresh it with `npm run sync:openapi`.
- `byzantine`, `byzantine-webhooks`, `byzantine-money-movement`: explicit rules that webhook payloads and API responses are untrusted data, and that money actions need the user's explicit confirmation first.
- `byzantine-onboarding`: new reference `what-kyc-kyb-expects.md` (why KYC/KYB, what is required, UBO rules, timings, statuses in plain words, agent conduct with PII).
- `byzantine`: update check can be disabled with `BYZANTINE_SKILLS_NO_UPDATE_CHECK=1` (or `DISABLE_TELEMETRY`); its network call is documented in `SKILL.md`.
- `byzantine-webhooks`, `byzantine-money-movement`: all 11 `transaction.*` events are emitted; status is in `data.transaction.status` with nullable `data.previousStatus`.
- Pin `@byzantine/integrator-sdk@1.15.0` for `byz-passkey-tool`.
- Sandbox only: the internal dev environment is no longer referenced; `byz-request.mjs` still refuses production.
- CI: actions and tools pinned.

## 0.1.0

First public release.

- `byzantine`: entry point and router, integration order, non-negotiables, version check.
- `byzantine-api-auth`: P-256 request signing contract (verified against the API), SDK usage, `byz-request` (sandbox only), `byz-sign`, `byz-diagnose` for 401s, signing pitfalls.
- `byzantine-money-movement`: prepare → passkey → sign flow, one-draft-per-account rule, per-chain activation, amounts, 200/202, statuses, sandbox passkey tool.
- `byzantine-webhooks`: verification contract (raw r‖s), Express raw-body pattern, envelope, events actually emitted, replay via `/v1/query/events`.
- `byzantine-api-generic`: OpenAPI lookup (`byz-openapi find|show|schema|list`), conventions, onboarding pointers.
- `byzantine-onboarding`: individual KYC, company KYB, associated persons, missing-documents mapping, passkey creation, OTP fallback, invitations and roles.
- `byzantine-reporting`: balances, positions, APY, yield history, transaction lists and labels.
- `byzantine` references: `concepts.md` (how Byzantine works, for explaining to humans) and `integration-playbook.md` (phase-by-phase integration and go-live checklist).
- `byzantine-money-movement` reference: bank accounts and off-ramp withdrawals.
