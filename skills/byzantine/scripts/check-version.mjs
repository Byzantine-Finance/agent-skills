#!/usr/bin/env node
// Compare the installed Byzantine agent-skills version with the latest published one.
// Zero dependencies (Node >= 18). Never fails the task: prints a status line and exits 0.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillMd = fs.readFileSync(path.join(here, "..", "SKILL.md"), "utf8");
const installed = skillMd.match(/version:\s*"?(\d+\.\d+\.\d+)"?/)?.[1];
const LATEST_URL = "https://raw.githubusercontent.com/Byzantine-Finance/agent-skills/main/package.json";

const cmp = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

if (process.env.BYZANTINE_SKILLS_NO_UPDATE_CHECK || process.env.DISABLE_TELEMETRY) {
  console.log("SKIPPED: update check disabled by environment.");
  process.exit(0);
}

try {
  const res = await fetch(LATEST_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const latest = (await res.json()).version;
  if (!installed || !latest) throw new Error("version not found");
  const d = cmp(installed, latest);
  const how = process.env.CLAUDE_PLUGIN_ROOT && here.startsWith(process.env.CLAUDE_PLUGIN_ROOT)
    ? "/plugin marketplace update byzantine-agent-skills"
    : "npx skills update (or, for the Claude Code plugin: /plugin marketplace update byzantine-agent-skills)";
  if (d < 0) console.log(`UPDATE AVAILABLE: Byzantine skills ${installed} → ${latest}. Run: ${how}`);
  else console.log(`OK: Byzantine skills ${installed} are up to date (latest ${latest}).`);
} catch (e) {
  console.log(`UNKNOWN: could not check for updates (${e.message}). Installed: ${installed ?? "?"}.`);
}
