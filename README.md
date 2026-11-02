# Byzantine Finance agent skills

[![skills.sh](https://skills.sh/b/Byzantine-Finance/agent-skills)](https://skills.sh/Byzantine-Finance/agent-skills)
[![CI](https://github.com/Byzantine-Finance/agent-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Byzantine-Finance/agent-skills/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Official [Agent Skills](https://agentskills.io) for integrating [Byzantine Finance](https://byzantine.fi), the non-custodial yield infrastructure for fintechs, B2B platforms and wealth managers. They teach your coding agent (Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, Windsurf and [40+ others](https://skills.sh)) how Byzantine works and how to integrate it end to end: onboarding and passkeys, request signing, passkey-signed deposits and withdrawals, balances and yield, and webhooks. Every rule in these skills is checked against the Byzantine API's actual behaviour.

## Install

### Any agent

```bash
npx skills add Byzantine-Finance/agent-skills
```

The CLI detects your agents and installs the skills where each one looks for them. Pick agents explicitly with `-a claude-code -a cursor -a codex`, or install everything non-interactively with `--all`.

> `npx skills add` installs the skills only. To also give your agent search over the Byzantine docs, add the docs MCP server (below).

### Claude Code (plugin: skills + docs MCP)

```text
/plugin marketplace add Byzantine-Finance/agent-skills
/plugin install byzantine@byzantine-agent-skills
```

Enable it for a whole team by committing this to `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "byzantine-agent-skills": { "source": { "source": "github", "repo": "Byzantine-Finance/agent-skills" } }
  },
  "enabledPlugins": { "byzantine@byzantine-agent-skills": true }
}
```

### Cursor, Codex, Copilot, Gemini CLI, Windsurf

```bash
npx skills add Byzantine-Finance/agent-skills -a cursor    # or -a codex, -a github-copilot, -a gemini-cli, -a windsurf
```

### Docs MCP server (optional, any client)

Search the Byzantine docs from your agent: `https://docs.byzantine.fi/mcp`.

```bash
claude mcp add --transport http byzantine-docs https://docs.byzantine.fi/mcp     # Claude Code
codex mcp add byzantine-docs --url https://docs.byzantine.fi/mcp                  # Codex
gemini mcp add -t http byzantine-docs https://docs.byzantine.fi/mcp               # Gemini CLI
```

- Cursor (`.cursor/mcp.json`): `{"mcpServers": {"byzantine-docs": {"url": "https://docs.byzantine.fi/mcp"}}}`
- VS Code (`.vscode/mcp.json`): `{"servers": {"byzantine-docs": {"type": "http", "url": "https://docs.byzantine.fi/mcp"}}}`

## Skills

| Skill | Use it for |
|---|---|
| [`byzantine`](skills/byzantine/SKILL.md) | Start here: how Byzantine works, the phase-by-phase integration playbook, which skill to use |
| [`byzantine-onboarding`](skills/byzantine-onboarding/SKILL.md) | Individual (KYC) and company (KYB) accounts, documents, passkey creation (web and native), OTP, invitations, roles |
| [`byzantine-api-auth`](skills/byzantine-api-auth/SKILL.md) | P-256 request signing, keys and scopes, debugging 401/403/429 |
| [`byzantine-money-movement`](skills/byzantine-money-movement/SKILL.md) | Activation, deposits, withdrawals, bank accounts, transfers, cancellations, passkey signing, statuses |
| [`byzantine-reporting`](skills/byzantine-reporting/SKILL.md) | Balances, positions, APY, yield history, transaction lists |
| [`byzantine-webhooks`](skills/byzantine-webhooks/SKILL.md) | Verifying deliveries, events actually emitted, replay with `/v1/query/events` |
| [`byzantine-api-generic`](skills/byzantine-api-generic/SKILL.md) | Finding any endpoint, field or enum in the live OpenAPI spec |

## Try it

Ask your agent:

- "We want to offer yield with Byzantine in our app. Where do we start?"
- "Explain to our CFO how Byzantine works, who holds the money and what it costs."
- "Add a Byzantine deposit button: backend route plus passkey signing in the browser."
- "My calls to sandbox.api.byzantine.fi return 401 Invalid signature, here is my code."
- "Write an Express endpoint that verifies Byzantine webhooks and updates KYC status."

## Credentials (sandbox only)

Some skills ship small scripts (Node.js 18+, no dependencies) to check your setup, such as a signed `whoami` call. They read your integrator key from the `BYZANTINE_PRIVATE_KEY` environment variable and **only call the sandbox API**: they refuse production hosts.

- Get a sandbox key from Byzantine, then create more in the [integrator dashboard](https://integrator.byzantine.fi) (Settings → API keys). Prefer a `read_only` key for agents.
- Keep it out of git, e.g. in `.claude/settings.local.json` → `{"env": {"BYZANTINE_PRIVATE_KEY": "0x…"}}` or in your shell environment.
- Never paste a production private key into an agent conversation.

## Updates

- Installed with `npx skills`: run `npx skills update`.
- Installed as a Claude Code plugin: run `/plugin marketplace update byzantine-agent-skills`, or enable auto-update in `/plugin` → Marketplaces.

Releases follow semver; see [CHANGELOG.md](CHANGELOG.md).

## Security

The scripts in `skills/*/scripts/` only sign requests locally with your key, call `sandbox.api.byzantine.fi` (never production), fetch the public OpenAPI spec, and check `raw.githubusercontent.com` for a newer version of these skills. They send an `X-Agent-Source: byzantine-agent-skills` header so Byzantine can tell agent traffic apart. Nothing else is collected. Report security issues to info@byzantine.fi.

## Related

- Docs: https://docs.byzantine.fi
- SDK: [`@byzantine/integrator-sdk`](https://www.npmjs.com/package/@byzantine/integrator-sdk)
- Integrator dashboard: https://integrator.byzantine.fi

## Contributing

`npm test` runs the script tests and `npm run validate` checks frontmatter, versions and manifests. Bump the version in `package.json`, `.claude-plugin/plugin.json`, every `SKILL.md` and `CHANGELOG.md` together; CI fails otherwise.

## License

[Apache-2.0](LICENSE)
