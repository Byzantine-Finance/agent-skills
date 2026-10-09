# AGENTS.md

This repo ships Agent Skills for Byzantine Finance integrators. It is content, not an app.

- Skills live in `skills/<name>/SKILL.md` (+ optional `scripts/`, `references/`). Folder name = `name`.
- Facts in skills must match the Byzantine API's actual behaviour. When docs and code disagree, the API wins; note the doc error in the skill.
- Bundled scripts: Node 18+, zero dependencies, read secrets from env vars only, and never call production.
- Before committing: `node scripts/validate.mjs && node --test tests/*.test.mjs`.
- Release: bump the same version in `package.json`, every `SKILL.md` `metadata.version`, `.claude-plugin/plugin.json` and add a `CHANGELOG.md` entry.
