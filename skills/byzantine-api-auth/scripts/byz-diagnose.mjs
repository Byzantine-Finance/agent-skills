#!/usr/bin/env node
// Diagnose a 401 offline: given the headers your code sent and the request it sent,
// say exactly what is wrong. Needs NO private key. Zero dependencies (Node >= 18).
//
//   node byz-diagnose.mjs --pubkey 0x02.. --timestamp 1760000000 --signature 0x30.. \
//     --method POST --path "/v1/query/get-deposit-payload-passkey?chain_id=8453" --body '{"a":1}'
//
// Optionally --sent-at <unix seconds> (when the request left), defaults to now.

import crypto from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1] ?? ""]] : acc), []),
);
for (const k of ["pubkey", "timestamp", "signature", "method", "path"]) {
  if (!args[k]) {
    console.error(`missing --${k}`);
    process.exit(2);
  }
}

const problems = [];
const notes = [];
const hex = (s) => s.trim().replace(/^0x/i, "");

// Public key
const pk = hex(args.pubkey);
let pubJwk;
if (!/^[0-9a-fA-F]+$/.test(pk)) problems.push("X-Pubkey is not hex.");
else if (pk.length === 130 && pk.startsWith("04")) {
  problems.push("X-Pubkey is UNCOMPRESSED (65 bytes). The API looks credentials up by the compressed key: send 0x02.. or 0x03.. (33 bytes). Signature may verify but you will get 401 \"Invalid public key\".");
} else if (pk.length !== 66 || !/^0[23]/.test(pk)) problems.push(`X-Pubkey must be 33 bytes compressed (0x02/0x03 + 64 hex chars); got ${pk.length / 2} bytes.`);
try {
  const uncompressed = crypto.ECDH.convertKey(pk, "prime256v1", "hex", "hex", "uncompressed");
  const b = Buffer.from(uncompressed, "hex");
  pubJwk = { kty: "EC", crv: "P-256", x: b.subarray(1, 33).toString("base64url"), y: b.subarray(33, 65).toString("base64url") };
} catch {
  problems.push("X-Pubkey is not a point on P-256. If you generated it with secp256k1 (Ethereum/bitcoin curve), that is the bug: Byzantine uses P-256 (secp256r1/prime256v1).");
}

// Timestamp
if (!/^\d+$/.test(args.timestamp)) problems.push("X-Timestamp must be integer Unix SECONDS (no decimals, no ms).");
else {
  const ts = Number(args.timestamp);
  if (ts > 1e12) problems.push("X-Timestamp looks like milliseconds. Use Math.floor(Date.now() / 1000).");
  const sentAt = Number(args["sent-at"] ?? Math.floor(Date.now() / 1000));
  const age = sentAt - ts;
  if (age > 60) problems.push(`Timestamp is ${age}s old when sent: the API accepts at most 60s in the past. Sign right before sending; check NTP.`);
  if (age < -10) problems.push(`Timestamp is ${-age}s in the future: the API accepts at most 10s of future skew. Check the clock.`);
}

// Path
const path = args.path;
if (/^https?:\/\//.test(path)) problems.push("--path must be path+query only, not a full URL (no scheme, no host).");
else if (!path.startsWith("/v1/")) problems.push(`Signed path must start with /v1/ (got "${path}"). Old doc samples sign "/submit/..." without /v1: that fails.`);
if (/\s/.test(path)) problems.push("Path contains whitespace: sign the exact percent-encoded string you send.");

// Signature
const sigHex = hex(args.signature);
const body = args.body ?? "";
const method = args.method;
if (method !== method.toUpperCase()) notes.push("Method is signed UPPERCASE; make sure your signer uppercases it.");
if (args.method.toUpperCase() === "GET" && body) problems.push("GET requests sign an empty body: drop the body from the message.");

const message = `${args.timestamp}${method.toUpperCase()}${path}${body}`;
if (pubJwk && /^[0-9a-fA-F]+$/.test(sigHex)) {
  const key = crypto.createPublicKey({ key: pubJwk, format: "jwk" });
  const sig = Buffer.from(sigHex, "hex");
  const tryVerify = (msg, enc) => {
    try {
      return crypto.verify("sha256", Buffer.from(msg, "utf8"), { key, dsaEncoding: enc }, sig);
    } catch {
      return false;
    }
  };
  const enc = sig.length === 64 ? "ieee-p1363" : "der";
  if (tryVerify(message, enc)) {
    notes.push(`Signature is VALID for message: ${JSON.stringify(message)}`);
    if (enc === "ieee-p1363") notes.push("Signature is raw r||s; the API accepts it, but DER is the documented format.");
  } else {
    problems.push(`Signature does NOT verify over ${JSON.stringify(message)}.`);
    // Guess common mistakes, alone and combined.
    const paths = [
      [path, null],
      [path.replace(/^\/v1/, ""), "signed the path WITHOUT the /v1 prefix"],
      [path.split("?")[0], "signed the path WITHOUT the query string"],
      [path.replace(/^\/v1/, "").split("?")[0], "signed the path without /v1 AND without the query string"],
    ];
    const bodies = [[body, null], ["", "signed an EMPTY body but sent one"]];
    try {
      const parsed = JSON.parse(body);
      for (const [b, why] of [
        [JSON.stringify(parsed), "signed a compact JSON.stringify of the body but sent different bytes (spaces/newlines)"],
        [JSON.stringify(parsed, null, 2), "signed a pretty-printed body but sent different bytes"],
        [JSON.stringify(Object.fromEntries(Object.entries(parsed).sort())), "signed the body with keys in a different order than sent"],
      ]) {
        if (b !== body) bodies.push([b, why]);
      }
    } catch {}
    const methods = [[method.toUpperCase(), null], [method.toLowerCase(), "signed a lowercase method"]];
    let hit = null;
    for (const [p, pw] of paths)
      for (const [b, bw] of bodies)
        for (const [m, mw] of methods) {
          if (hit || (!pw && !bw && !mw)) continue;
          const msg = `${args.timestamp}${m}${p}${b}`;
          if (tryVerify(msg, "der") || tryVerify(msg, "ieee-p1363")) hit = [pw, bw, mw].filter(Boolean).join("; ");
        }
    if (hit) problems.push(`Found it: you ${hit}.`);
    else problems.push("No common mistake matched. Likely: wrong curve (secp256k1), double SHA-256 hashing, signing with a different key than X-Pubkey, or a proxy rewriting the path/body after signing.");
  }
} else if (!/^[0-9a-fA-F]+$/.test(sigHex)) {
  problems.push("X-Signature must be hex (0x + DER hex). Base64 is not accepted.");
}

console.log(JSON.stringify({ ok: problems.length === 0, problems, notes }, null, 2));
process.exit(problems.length ? 1 : 0);
