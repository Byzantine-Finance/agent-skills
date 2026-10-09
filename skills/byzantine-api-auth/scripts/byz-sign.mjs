#!/usr/bin/env node
// Sign one Byzantine API request and print the headers. Zero dependencies (Node >= 18).
//
//   BYZANTINE_PRIVATE_KEY=0x... node byz-sign.mjs GET "/v1/query/top-vaults"
//   BYZANTINE_PRIVATE_KEY=0x... node byz-sign.mjs POST "/v1/query/get-deposit-payload-passkey?chain_id=8453" '{"accountId":"..."}'
//
// The key is read from the environment only, never from argv (argv lands in shell history).
// Output: JSON with the three auth headers and the exact message that was signed.

import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export function loadPrivateKey(hex) {
  const clean = String(hex ?? "").trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("BYZANTINE_PRIVATE_KEY must be 32 bytes of hex (64 chars, optional 0x prefix)");
  }
  const ecdh = crypto.createECDH("prime256v1"); // = P-256 = secp256r1. NOT secp256k1.
  ecdh.setPrivateKey(Buffer.from(clean, "hex"));
  const pub = ecdh.getPublicKey(); // 0x04 || X || Y
  const key = crypto.createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: Buffer.from(clean, "hex").toString("base64url"),
      x: pub.subarray(1, 33).toString("base64url"),
      y: pub.subarray(33, 65).toString("base64url"),
    },
  });
  // The API looks credentials up by the COMPRESSED key (0x02/0x03 + 32 bytes).
  const pubkey = `0x${ecdh.getPublicKey("hex", "compressed")}`;
  return { key, pubkey };
}

export function buildMessage(timestamp, method, pathAndQuery, body) {
  return `${timestamp}${method.toUpperCase()}${pathAndQuery}${body ?? ""}`;
}

export function sign({ key, pubkey }, method, pathAndQuery, body = "", now = Date.now()) {
  if (!pathAndQuery.startsWith("/v1/") && pathAndQuery !== "/v1") {
    throw new Error(`path must be the full path starting with /v1/ (got "${pathAndQuery}")`);
  }
  const timestamp = Math.floor(now / 1000).toString();
  const message = buildMessage(timestamp, method, pathAndQuery, body);
  const signature = crypto.sign("sha256", Buffer.from(message, "utf8"), { key, dsaEncoding: "der" });
  return {
    headers: {
      "X-Pubkey": pubkey,
      "X-Timestamp": timestamp,
      "X-Signature": `0x${signature.toString("hex")}`,
      "Content-Type": "application/json",
    },
    message,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [method, pathAndQuery, body = ""] = process.argv.slice(2);
  if (!method || !pathAndQuery) {
    console.error('usage: BYZANTINE_PRIVATE_KEY=0x... node byz-sign.mjs <METHOD> "<path?query>" [body-json]');
    process.exit(2);
  }
  try {
    const out = sign(loadPrivateKey(process.env.BYZANTINE_PRIVATE_KEY), method, pathAndQuery, body);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}
