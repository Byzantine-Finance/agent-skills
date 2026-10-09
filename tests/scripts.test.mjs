// Offline tests for the bundled scripts. Run: npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildMessage, loadPrivateKey, sign } from "../skills/byzantine-api-auth/scripts/byz-sign.mjs";
import { verifyByzantineWebhook } from "../skills/byzantine-webhooks/scripts/byz-verify-webhook.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authScripts = path.join(root, "skills/byzantine-api-auth/scripts");
const run = (script, args, env = {}) =>
  spawnSync(process.execPath, [path.join(authScripts, script), ...args], { encoding: "utf8", env: { ...process.env, ...env } });

const PRIV = `0x${"11".repeat(32)}`;

// Server-side verification as implemented by the API: P-256, SHA-256, DER or raw r||s.
function serverVerify(headers, method, pathAndQuery, body) {
  const pub = Buffer.from(crypto.ECDH.convertKey(headers["X-Pubkey"].slice(2), "prime256v1", "hex", "hex", "uncompressed"), "hex");
  const key = crypto.createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") } });
  const msg = `${headers["X-Timestamp"]}${method}${pathAndQuery}${body}`;
  return crypto.verify("sha256", Buffer.from(msg), { key, dsaEncoding: "der" }, Buffer.from(headers["X-Signature"].slice(2), "hex"));
}

test("sign: compressed pubkey, seconds timestamp, DER signature the server accepts", () => {
  const body = JSON.stringify({ accountId: "a", amount: "1.5" });
  const p = "/v1/query/get-deposit-payload-passkey?chain_id=8453";
  const { headers, message } = sign(loadPrivateKey(PRIV), "post", p, body, 1_760_000_000_123);
  assert.match(headers["X-Pubkey"], /^0x0[23][0-9a-f]{64}$/);
  assert.equal(headers["X-Timestamp"], "1760000000");
  assert.match(headers["X-Signature"], /^0x30/);
  assert.equal(message, buildMessage("1760000000", "POST", p, body));
  assert.ok(serverVerify(headers, "POST", p, body));
});

test("sign: GET signs an empty body", () => {
  const { headers } = sign(loadPrivateKey(PRIV), "GET", "/v1/integrator/whoami");
  assert.ok(serverVerify(headers, "GET", "/v1/integrator/whoami", ""));
});

test("sign: rejects paths without /v1 and malformed keys", () => {
  assert.throws(() => sign(loadPrivateKey(PRIV), "POST", "/submit/deposit", ""), /\/v1\//);
  assert.throws(() => loadPrivateKey("0x1234"), /32 bytes/);
});

test("byz-request: refuses production hosts without sending anything", () => {
  const r = run("byz-request.mjs", ["GET", "/v1/integrator/whoami"], { BYZANTINE_PRIVATE_KEY: PRIV, BYZANTINE_BASE_URL: "https://api.byzantine.fi" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /never calls production/);
});

test("byz-diagnose: valid request passes, /v1 + re-serialized body mistake is named", () => {
  const sent = JSON.stringify({ b: 2, a: 1 }, null, 2);
  const ok = sign(loadPrivateKey(PRIV), "POST", "/v1/submit/x", sent).headers;
  const good = run("byz-diagnose.mjs", ["--pubkey", ok["X-Pubkey"], "--timestamp", ok["X-Timestamp"], "--signature", ok["X-Signature"], "--method", "POST", "--path", "/v1/submit/x", "--body", sent]);
  assert.equal(good.status, 0, good.stdout);

  const { key, pubkey } = loadPrivateKey(PRIV);
  const ts = String(Math.floor(Date.now() / 1000));
  const bad = crypto.sign("sha256", Buffer.from(`${ts}POST/submit/x${JSON.stringify({ b: 2, a: 1 })}`), { key, dsaEncoding: "der" });
  const r = run("byz-diagnose.mjs", ["--pubkey", pubkey, "--timestamp", ts, "--signature", `0x${bad.toString("hex")}`, "--method", "POST", "--path", "/v1/submit/x", "--body", sent]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /WITHOUT the \/v1 prefix/);
  assert.match(r.stdout, /compact JSON\.stringify/);
});

test("byz-diagnose: flags uncompressed keys and millisecond timestamps", () => {
  const { pubkey } = loadPrivateKey(PRIV);
  const uncompressed = `0x${crypto.ECDH.convertKey(pubkey.slice(2), "prime256v1", "hex", "hex", "uncompressed")}`;
  const r = run("byz-diagnose.mjs", ["--pubkey", uncompressed, "--timestamp", String(Date.now()), "--signature", "0x3000", "--method", "GET", "--path", "/v1/x"]);
  assert.match(r.stdout, /UNCOMPRESSED/);
  assert.match(r.stdout, /milliseconds/);
});

// Webhooks: replicate the API signer (raw r||s, lowercase hex, no 0x).
function makeDelivery(body, ts) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const pub = ecdh.getPublicKey();
  const key = crypto.createPrivateKey({ format: "jwk", key: { kty: "EC", crv: "P-256", d: ecdh.getPrivateKey().toString("base64url"), x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") } });
  const event = JSON.parse(body);
  const input = Buffer.concat([Buffer.from(`del-1.${event.id}.${ts}.`), Buffer.from(body)]);
  const sig = crypto.sign("sha256", input, { key, dsaEncoding: "ieee-p1363" }).toString("hex");
  return {
    publicKey: `0x${ecdh.getPublicKey("hex", "compressed")}`,
    headers: {
      "X-Byzantine-Webhook-Delivery-Id": "del-1",
      "X-Byzantine-Webhook-Event-Id": event.id,
      "X-Byzantine-Webhook-Timestamp": String(ts),
      "X-Byzantine-Webhook-Algorithm": "ECDSA_P256_SHA256",
      "X-Byzantine-Webhook-Signature": sig,
    },
  };
}

test("webhook: verifies a delivery signed like the API, rejects tampering, staleness and parsed bodies", () => {
  const body = '{"id":"evt-1","type":"customer.active","livemode":true,"payloadVersion":1}';
  const now = 1_760_000_000;
  const d = makeDelivery(body, now);
  const ok = verifyByzantineWebhook({ headers: d.headers, rawBody: Buffer.from(body), publicKey: d.publicKey, now });
  assert.equal(ok.ok, true);
  assert.equal(ok.event.type, "customer.active");

  assert.equal(verifyByzantineWebhook({ headers: d.headers, rawBody: body.replace("active", "rejected"), publicKey: d.publicKey, now }).reason, "invalid signature");
  assert.match(verifyByzantineWebhook({ headers: d.headers, rawBody: body, publicKey: d.publicKey, now: now + 301 }).reason, /tolerance/);
  assert.match(verifyByzantineWebhook({ headers: d.headers, rawBody: JSON.parse(body), publicKey: d.publicKey, now }).reason, /raw/);
  const lower = Object.fromEntries(Object.entries(d.headers).map(([k, v]) => [k.toLowerCase(), v]));
  assert.equal(verifyByzantineWebhook({ headers: lower, rawBody: body, publicKey: d.publicKey, now }).ok, true);
});
