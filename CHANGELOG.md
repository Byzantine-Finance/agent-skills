# Changelog

## 0.1.0

First release.

- `byzantine`: entry point and router, integration order, non-negotiables, version check.
- `byzantine-api-auth`: P-256 request signing contract (verified against the API), SDK usage, `byz-request` (sandbox only), `byz-sign`, `byz-diagnose` for 401s, signing pitfalls.
- `byzantine-money-movement`: prepare → passkey → sign flow, one-draft-per-account rule, per-chain activation, amounts, 200/202, statuses, sandbox passkey tool.
- `byzantine-webhooks`: verification contract (raw r‖s), Express raw-body pattern, envelope, events actually emitted, replay via `/v1/query/events`.
- `byzantine-api-generic`: live OpenAPI lookup (`byz-openapi find|show|schema|list`), conventions, onboarding pointers.
