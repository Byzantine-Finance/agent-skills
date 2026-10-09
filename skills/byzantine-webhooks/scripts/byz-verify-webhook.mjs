#!/usr/bin/env node
// Reference verifier for Byzantine webhook deliveries. Zero dependencies (Node >= 18).
// Import verifyByzantineWebhook() in your receiver, or run as a CLI to check a captured delivery:
//
//   node byz-verify-webhook.mjs --public-key 0x02.. --headers headers.json --body body.raw [--now <unix s>]
//
// headers.json: {"x-byzantine-webhook-delivery-id": "...", ...} as received.
// body.raw: the EXACT raw request bytes (not re-serialized JSON).

import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const TOLERANCE_SECONDS = 300;

function publicKeyFromCompressedHex(hex) {
  const clean = String(hex).trim().replace(/^0x/i, "");
  const raw = Buffer.from(crypto.ECDH.convertKey(clean, "prime256v1", "hex", "hex", "uncompressed"), "hex");
  return crypto.createPublicKey({
    format: "jwk",
    key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33, 65).toString("base64url") },
  });
}

/**
 * @param {object} p
 * @param {Record<string,string>} p.headers  request headers (any case)
 * @param {Buffer|string} p.rawBody          exact raw bytes received
 * @param {string} p.publicKey               subscription publicKey (0x02.. compressed hex)
 * @param {number} [p.now]                   unix seconds
 * @returns {{ ok: true, event: object } | { ok: false, reason: string }}
 */
export function verifyByzantineWebhook({ headers, rawBody, publicKey, now = Math.floor(Date.now() / 1000) }) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
  const deliveryId = h["x-byzantine-webhook-delivery-id"];
  const eventId = h["x-byzantine-webhook-event-id"];
  const timestamp = h["x-byzantine-webhook-timestamp"];
  const algorithm = h["x-byzantine-webhook-algorithm"];
  const signature = h["x-byzantine-webhook-signature"];
  if (!deliveryId || !eventId || !timestamp || !signature) return { ok: false, reason: "missing X-Byzantine-Webhook-* header" };
  if (algorithm && algorithm !== "ECDSA_P256_SHA256") return { ok: false, reason: `unexpected algorithm ${algorithm}` };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "timestamp is not unix seconds" };
  if (Math.abs(now - Number(timestamp)) > TOLERANCE_SECONDS) return { ok: false, reason: "timestamp outside 300s tolerance" };
  if (rawBody == null) return { ok: false, reason: "rawBody is missing: capture the raw bytes (express.json({ verify }) or express.raw())" };
  if (typeof rawBody === "object" && !Buffer.isBuffer(rawBody)) {
    return { ok: false, reason: "rawBody is parsed JSON: a JSON body parser ran before this route. Capture the raw bytes (see SKILL.md)" };
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const signingInput = Buffer.concat([Buffer.from(`${deliveryId}.${eventId}.${timestamp}.`, "utf8"), body]);
  const sig = Buffer.from(signature.trim().replace(/^0x/i, ""), "hex");
  // Byzantine sends raw 64-byte r||s (NOT DER like request signatures). Accept DER too, defensively.
  const dsaEncoding = sig.length === 64 ? "ieee-p1363" : "der";
  let valid = false;
  try {
    valid = crypto.verify("sha256", signingInput, { key: publicKeyFromCompressedHex(publicKey), dsaEncoding }, sig);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "invalid signature" };

  let event;
  try {
    event = JSON.parse(body.toString("utf8"));
  } catch {
    return { ok: false, reason: "body is not JSON" };
  }
  if (event.id !== eventId) return { ok: false, reason: "body id does not match X-Byzantine-Webhook-Event-Id" };
  return { ok: true, event };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const a = process.argv.slice(2);
  const get = (k) => a[a.indexOf(`--${k}`) + 1];
  if (!a.includes("--public-key") || !a.includes("--headers") || !a.includes("--body")) {
    console.error("usage: node byz-verify-webhook.mjs --public-key 0x02.. --headers headers.json --body body.raw [--now <unix s>]");
    process.exit(2);
  }
  const result = verifyByzantineWebhook({
    publicKey: get("public-key"),
    headers: JSON.parse(fs.readFileSync(get("headers"), "utf8")),
    rawBody: fs.readFileSync(get("body")),
    now: a.includes("--now") ? Number(get("now")) : undefined,
  });
  console.log(JSON.stringify(result.ok ? { ok: true, type: result.event.type, id: result.event.id } : result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
