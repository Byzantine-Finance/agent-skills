#!/usr/bin/env node
// Maintainers: refresh the OpenAPI snapshot bundled with the byzantine-api-generic skill.
// Run before every release, review the diff, and mention API changes in CHANGELOG.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "byzantine-api-generic", "references", "openapi-integrator.json");
const res = await fetch("https://api.byzantine.fi/api-docs/openapi-integrator.json");
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const text = await res.text();
const spec = JSON.parse(text);
fs.writeFileSync(target, text);
console.log(`wrote ${target}: ${spec.info?.title} ${spec.info?.version}, ${Object.keys(spec.paths ?? {}).length} paths`);
