#!/usr/bin/env node
// Repo lint: frontmatter per the Agent Skills spec, one version everywhere,
// manifests list every skill, and every referenced skill/script exists. Zero dependencies.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const errors = [];
const err = (m) => errors.push(m);
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const pkg = JSON.parse(read("package.json"));
const marketplace = JSON.parse(read(".claude-plugin/marketplace.json"));
const skillsSh = JSON.parse(read("skills.sh.json"));
const skillDirs = fs.readdirSync(path.join(root, "skills")).filter((d) => fs.existsSync(path.join(root, "skills", d, "SKILL.md")));

function frontmatter(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return err(`${file}: missing YAML frontmatter`), {};
  const fm = {};
  let parent = null;
  for (const line of m[1].split("\n")) {
    const nested = line.match(/^ {2}([a-zA-Z_-]+):\s*(.*)$/);
    const top = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (top) {
      parent = top[1];
      fm[parent] = top[2].replace(/^"(.*)"$/, "$1");
    } else if (nested && parent) {
      if (typeof fm[parent] !== "object") fm[parent] = {};
      fm[parent][nested[1]] = nested[2].replace(/^"(.*)"$/, "$1");
    } else if (line.trim()) err(`${file}: unparseable frontmatter line "${line}"`);
  }
  return fm;
}

for (const dir of skillDirs) {
  const file = `skills/${dir}/SKILL.md`;
  const text = read(file);
  const fm = frontmatter(text, file);
  if (fm.name !== dir) err(`${file}: name "${fm.name}" must equal folder "${dir}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name ?? "") || fm.name.length > 64) err(`${file}: invalid name`);
  if (!fm.description || fm.description.length > 1024) err(`${file}: description missing or > 1024 chars`);
  if (!/^Use when /.test(fm.description ?? "")) err(`${file}: description should start with "Use when"`);
  if (fm.metadata?.version !== pkg.version) err(`${file}: metadata.version ${fm.metadata?.version} != package.json ${pkg.version}`);
  const lines = text.split("\n").length;
  if (lines > 500) err(`${file}: ${lines} lines (keep SKILL.md under 500)`);

  for (const [, ref] of text.matchAll(/`(byzantine(?:-[a-z]+)*)`/g)) {
    if (!skillDirs.includes(ref) && !ref.startsWith("byzantine-agent")) err(`${file}: references unknown skill \`${ref}\``);
  }
  for (const [, rel] of text.matchAll(/(?:node |`)((?:\.\.\/[a-z-]+\/)?(?:scripts|references)\/[A-Za-z0-9._-]+)/g)) {
    if (!fs.existsSync(path.join(root, "skills", dir, rel))) err(`${file}: references missing file ${rel}`);
  }
}

const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
if (plugin.version !== pkg.version) err(`.claude-plugin/plugin.json version ${plugin.version} != package.json ${pkg.version}`);
if (!marketplace.plugins.some((p) => p.name === plugin.name && p.source === "./")) err(`marketplace.json must list plugin "${plugin.name}" with source "./"`);

const grouped = skillsSh.groupings.flatMap((g) => g.skills);
for (const d of skillDirs) if (!grouped.includes(d)) err(`skills.sh.json: skill ${d} not in any group`);
for (const s of grouped) if (!skillDirs.includes(s)) err(`skills.sh.json: lists missing skill ${s}`);

if (!read("CHANGELOG.md").includes(`## ${pkg.version}`)) err(`CHANGELOG.md has no "## ${pkg.version}" entry`);

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${skillDirs.length} skills valid (v${pkg.version})`);
