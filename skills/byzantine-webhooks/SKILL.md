---
name: byzantine-webhooks
description: Use when receiving, verifying or debugging Byzantine Finance webhooks or lifecycle events - X-Byzantine-Webhook-Signature / Delivery-Id / Event-Id / Timestamp headers, webhook subscriptions and their publicKey, customer.* KYC/KYB events, transaction.* events, delivery retries, replaying events with GET /v1/query/events, or a receiver that rejects valid deliveries.
license: Apache-2.0
metadata:
  version: "0.1.0"
---

# Byzantine webhooks

Subscriptions are managed with the signed API (`/v1/webhooks/subscriptions`, see `byzantine-api-auth`) or in the dashboard (integrator.byzantine.fi → Webhooks → Configure). Each subscription has its own P-256 key; its `publicKey` (compressed hex, `0x02…`) is returned by create/list and shown in the dashboard.

## Verification contract

| Item | Value |
|---|---|
| Signing input | `{Delivery-Id}.{Event-Id}.{Timestamp}.{rawBody}` — the **exact raw bytes** received |
| Algorithm | ECDSA P-256 + SHA-256 (`X-Byzantine-Webhook-Algorithm: ECDSA_P256_SHA256`) |
| Signature | hex of **raw 64-byte r‖s**, no `0x`. Different from request signatures (DER). |
| Timestamp | Unix seconds; reject outside ±300 s |
| Key | the subscription `publicKey`; `X-Byzantine-Webhook-Key-Id` identifies it |
| Success | any 2xx within 10 s. Otherwise retried after 30 s, 60 s, 5 min, 30 min, 2 h, 6 h, then `terminal_failed` |

Use `scripts/byz-verify-webhook.mjs` (exports `verifyByzantineWebhook`) as the reference implementation or port it.

## Express receiver (the raw-body trap)

`express.json()` parses the body and discards the raw bytes, so signature checks fail. Once a global `express.json()` has run, a route-level `express.raw()` is skipped and `req.body` is already an object. The robust fix is to keep the raw bytes in the global parser:

```js
import { verifyByzantineWebhook } from "./byz-verify-webhook.mjs";

app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })); // replaces the plain app.use(express.json())

app.post("/webhooks/byzantine", async (req, res) => {
  const r = verifyByzantineWebhook({ headers: req.headers, rawBody: req.rawBody, publicKey: process.env.BYZANTINE_WEBHOOK_PUBLIC_KEY });
  if (!r.ok) return res.status(401).end();
  await db.transaction(async (tx) => {           // dedupe + apply atomically: at-least-once delivery
    if (await tx.insertEventIfAbsent(r.event.id)) await apply(tx, r.event);
  });
  res.status(200).end();                         // throw → 500 → Byzantine retries
});
```

If you cannot touch the global parser, register this route with `express.raw({ type: "application/json" })` **before** `app.use(express.json())` and pass `req.body` (a Buffer) as `rawBody`.

Next.js route handler: `const raw = Buffer.from(await req.arrayBuffer())` before any `req.json()`.

## Envelope

```json
{ "id": "…", "type": "customer.active", "occurredAt": "…", "livemode": true, "payloadVersion": 1,
  "related": { "accountId": "…", "userId": null, "entityId": null, "beneficiaryId": null, "transactionId": null },
  "data": { … } }
```

- `related` always has all five keys (null when unused).
- `livemode` is `true` for every real event **in sandbox too**; only `webhook.test` has `false`. Don't use it to tell environments apart: use separate subscriptions/URLs per environment.
- `webhook.test` (from `POST /v1/webhooks/subscriptions/{id}/test`) has **no `related`** (use `event.related?.accountId`) and `data: {message, integratorId, subscriptionId}`.

## Events actually sent today

- `customer.created | under_review | awaiting_associated_person_information | resubmission_requested | active | rejected | deactivated | deleted`. `data` = `{ customer: {accountId, customerType: "individual"|"entity", userId, entityId, name, email, verificationStatus, createdAt}, beneficiary | null, reasonCodes | null }`.
- `transaction.withdrawal_initiated` only. The other `transaction.*` types exist in the API enum but are **not emitted yet**: poll `GET /v1/query/get-transaction` for transaction progress.

`verificationStatus` values (API enum): `not_started`, `init`, `awaiting_information`, `under_review`, `awaiting_associated_person_information`, `resubmission_requested`, `active`, `rejected`, `inactive`. Some doc pages say `waiting_for_information`: the API sends `awaiting_information`. Unknown future values must not crash the handler. Event names say `deactivated`/`deleted`; the status they carry is `inactive`.

## Replay and backfill

`GET /v1/query/events` returns the same envelope (+ `createdAt`), newest first. Filters: `accountId`, `userId`, `transactionId`, `eventType`, `createdAfter`, `createdBefore`; `limit` 1–250; `cursor`/`nextCursor`. Re-sign each page (the cursor is in the signed query). Use it after downtime instead of relying on retries alone.

## Checklist

- Raw body preserved; signature checked before parsing.
- Timestamp window 300 s; body `id` equals the Event-Id header.
- Idempotent on `id` (unique constraint); out-of-order safe (compare `occurredAt`).
- Respond 2xx fast; do slow work async.
- HTTPS public hostname only (no IPs, localhost, credentials or fragments in the URL).
