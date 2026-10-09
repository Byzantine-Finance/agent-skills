#!/usr/bin/env node
// Look up Byzantine Integrator API endpoints in the live OpenAPI spec. Zero dependencies (Node >= 18).
//
//   node byz-openapi.mjs find deposit payload        # list matching operations
//   node byz-openapi.mjs show get_deposit_payload_passkey
//   node byz-openapi.mjs show "POST /v1/query/get-deposit-payload-passkey"
//   node byz-openapi.mjs schema DepositRequestBody
//   node byz-openapi.mjs list                        # every operation
//
// The spec is cached for 24h in $XDG_CACHE_HOME (or ~/.cache)/byzantine-agent-skills/.
// BYZANTINE_OPENAPI_URL overrides the source.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SOURCES = [
  process.env.BYZANTINE_OPENAPI_URL,
  "https://api.byzantine.fi/api-docs/openapi-integrator.json",
  "https://docs.byzantine.fi/api-reference/openapi-integrator.json",
].filter(Boolean);
const CACHE_DIR = path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "byzantine-agent-skills");
const CACHE_FILE = path.join(CACHE_DIR, "openapi-integrator.json");
const TTL_MS = 24 * 3600 * 1000;
const METHODS = ["get", "post", "put", "patch", "delete"];

async function loadSpec() {
  try {
    if (Date.now() - fs.statSync(CACHE_FILE).mtimeMs < TTL_MS) return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {}
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { headers: { "X-Agent-Source": "byzantine-agent-skills" } });
      if (!res.ok) continue;
      const text = await res.text();
      const spec = JSON.parse(text);
      try {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, text);
      } catch {}
      return spec;
    } catch {}
  }
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); // stale cache beats nothing
  } catch {}
  throw new Error(`could not fetch the OpenAPI spec from ${SOURCES.join(", ")}`);
}

function operations(spec) {
  const ops = [];
  for (const [p, item] of Object.entries(spec.paths ?? {}))
    for (const m of METHODS) if (item[m]) ops.push({ method: m.toUpperCase(), path: p, op: item[m], shared: item.parameters ?? [] });
  return ops;
}

function resolve(spec, node, depth = 0, seen = new Set()) {
  if (!node || typeof node !== "object") return node;
  if (node.$ref) {
    const name = node.$ref.split("/").pop();
    if (seen.has(name) || depth > 6) return { $ref: name };
    const target = node.$ref.split("/").slice(1).reduce((o, k) => o?.[k], spec);
    return { "x-schema": name, ...resolve(spec, target, depth + 1, new Set([...seen, name])) };
  }
  if (Array.isArray(node)) return node.map((n) => resolve(spec, n, depth, seen));
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "example" || k === "examples") continue; // keep output short; schemas carry the contract
    out[k] = resolve(spec, v, depth, seen);
  }
  return out;
}

function line(o) {
  return `${o.method.padEnd(6)} ${o.path}  [${o.op.operationId ?? "-"}]  ${o.op.summary ?? ""}`;
}

const [cmd, ...rest] = process.argv.slice(2);
const spec = await loadSpec().catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});
const ops = operations(spec);

if (cmd === "list") {
  console.log(`${spec.info?.title} ${spec.info?.version} — ${ops.length} operations`);
  for (const o of ops) console.log(line(o));
} else if (cmd === "find" && rest.length) {
  const words = rest.join(" ").toLowerCase().split(/\s+/);
  const scored = ops
    .map((o) => {
      const hay = `${o.method} ${o.path} ${o.op.operationId} ${o.op.summary} ${o.op.description} ${(o.op.tags ?? []).join(" ")}`.toLowerCase();
      return { o, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) console.log("no match — try `list`");
  for (const { o } of scored.slice(0, 15)) console.log(line(o));
} else if (cmd === "show" && rest.length) {
  const q = rest.join(" ").trim();
  const [qm, qp] = q.includes(" ") ? q.split(/\s+/) : [null, null];
  const o = ops.find((x) => x.op.operationId === q || (qm && x.method === qm.toUpperCase() && x.path === qp));
  if (!o) {
    console.error(`no operation "${q}" — use \`find\` first. Never guess a path.`);
    process.exit(1);
  }
  const params = [...o.shared, ...(o.op.parameters ?? [])]
    .map((p) => resolve(spec, p))
    .filter((p) => !["X-Pubkey", "X-Timestamp", "X-Signature"].includes(p.name))
    .map((p) => ({ in: p.in, name: p.name, required: !!p.required, schema: p.schema, description: p.description }));
  const body = o.op.requestBody ? resolve(spec, o.op.requestBody.content?.["application/json"]?.schema ?? o.op.requestBody) : null;
  const responses = Object.fromEntries(
    Object.entries(o.op.responses ?? {}).map(([code, r]) => [code, { description: r.description, schema: resolve(spec, r.content?.["application/json"]?.schema) }]),
  );
  console.log(
    JSON.stringify(
      {
        operation: `${o.method} ${o.path}`,
        operationId: o.op.operationId,
        summary: o.op.summary,
        description: o.op.description,
        auth: (o.op.security ?? spec.security ?? []).length ? "signed integrator request (see byzantine-api-auth)" : "none",
        writeScope: o.method === "GET" ? "read_only OK" : "needs read_write key",
        parameters: params,
        requestBody: body,
        responses,
      },
      null,
      2,
    ),
  );
} else if (cmd === "schema" && rest[0]) {
  const s = spec.components?.schemas?.[rest[0]];
  if (!s) {
    const near = Object.keys(spec.components?.schemas ?? {}).filter((k) => k.toLowerCase().includes(rest[0].toLowerCase()));
    console.error(`no schema "${rest[0]}". Close: ${near.slice(0, 10).join(", ") || "none"}`);
    process.exit(1);
  }
  console.log(JSON.stringify(resolve(spec, s), null, 2));
} else {
  console.error("usage: node byz-openapi.mjs list | find <words> | show <operationId|'METHOD /path'> | schema <Name>");
  process.exit(2);
}
