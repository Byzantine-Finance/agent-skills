#!/usr/bin/env node
// Send one signed request to the Byzantine SANDBOX (or dev) API and print status + body.
// Zero dependencies (Node >= 18). Refuses production on purpose: use your app for that.
//
//   BYZANTINE_PRIVATE_KEY=0x... node byz-request.mjs GET /v1/integrator/whoami
//   BYZANTINE_PRIVATE_KEY=0x... node byz-request.mjs POST "/v1/query/get-deposit-payload-passkey?chain_id=8453" '{"accountId":"..."}'
//
// Environment: BYZANTINE_ENV=sandbox (default) | dev, or BYZANTINE_BASE_URL=<url>. Keys are per environment.

import { loadPrivateKey, sign } from "./byz-sign.mjs";

const ALLOWED_HOSTS = new Set(["sandbox.api.byzantine.fi", "dev.api.byzantine.fi", "localhost", "127.0.0.1"]);

const [method, pathAndQuery, body = ""] = process.argv.slice(2);
if (!method || !pathAndQuery) {
  console.error('usage: BYZANTINE_PRIVATE_KEY=0x... node byz-request.mjs <METHOD> "<path?query>" [body-json]');
  process.exit(2);
}

const ENVS = { sandbox: "https://sandbox.api.byzantine.fi", dev: "https://dev.api.byzantine.fi" };
const envName = process.env.BYZANTINE_ENV ?? "sandbox";
if (!process.env.BYZANTINE_BASE_URL && !ENVS[envName]) {
  console.error(`refused: BYZANTINE_ENV must be one of ${Object.keys(ENVS).join(", ")} (production is never called)`);
  process.exit(3);
}
const base = new URL(process.env.BYZANTINE_BASE_URL ?? ENVS[envName]);
if (!ALLOWED_HOSTS.has(base.hostname)) {
  console.error(`refused: ${base.hostname} is not a sandbox/dev host. This script never calls production.`);
  process.exit(3);
}
if (body) {
  try {
    JSON.parse(body);
  } catch {
    console.error("refused: body is not valid JSON");
    process.exit(2);
  }
}

try {
  const { headers, message } = sign(loadPrivateKey(process.env.BYZANTINE_PRIVATE_KEY), method, pathAndQuery, body);
  // Send exactly the bytes that were signed: same path string, same body string.
  const res = await fetch(new URL(pathAndQuery, base), {
    method: method.toUpperCase(),
    headers: { ...headers, "X-Agent-Source": "byzantine-agent-skills" },
    body: body || undefined,
  });
  const text = await res.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {}
  const out = { baseUrl: base.origin, pubkey: headers["X-Pubkey"], status: res.status, signedMessage: message, body: parsed };
  const err = typeof parsed === "object" ? parsed?.error ?? "" : "";
  if (err === "Invalid public key") {
    out.hint = `Signature is valid, but ${base.hostname} has no credential with this public key. Keys are per environment: set BYZANTINE_ENV=dev or sandbox to match where the key was issued, or check it was not revoked.`;
  } else if (err.startsWith("Invalid signature")) {
    out.hint = "Signature rejected: run byz-diagnose.mjs with the headers above, see references/signing-pitfalls.md.";
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
