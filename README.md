# Byzantine Finance agent skills

Official [Agent Skills](https://agentskills.io) for integrating [Byzantine Finance](https://byzantine.fi): they teach your coding agent (Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, Windsurf and [40+ others](https://skills.sh)) how to sign API requests, run passkey-signed deposits and withdrawals, and verify webhooks the way the Byzantine API actually works.

## Install

```bash
npx skills add Byzantine-Finance/agent-skills
```

Claude Code plugin (skills + the Byzantine docs MCP server):

```text
/plugin marketplace add Byzantine-Finance/agent-skills
/plugin install byzantine@byzantine-agent-skills
```

Update later with `npx skills update`.

## Skills

| Skill | Use it for |
|---|---|
| [`byzantine`](skills/byzantine/SKILL.md) | Entry point: how to integrate, which skill to use, non-negotiables |
| [`byzantine-api-auth`](skills/byzantine-api-auth/SKILL.md) | P-256 request signing, keys and scopes, debugging 401/403/429 |
| [`byzantine-money-movement`](skills/byzantine-money-movement/SKILL.md) | Activation, deposits, withdrawals, transfers, cancellations, passkey signing, statuses |
| [`byzantine-webhooks`](skills/byzantine-webhooks/SKILL.md) | Verifying deliveries, events actually emitted, replay with `/v1/query/events` |
| [`byzantine-api-generic`](skills/byzantine-api-generic/SKILL.md) | Finding any endpoint, field or enum in the live OpenAPI spec |

Scripts bundled with the skills need Node.js 18+ and have no dependencies. `byz-request.mjs` only talks to the sandbox.

## Try it

Ask your agent:

- "Add a Byzantine deposit button: backend route plus passkey signing in the browser."
- "My calls to sandbox.api.byzantine.fi return 401 Invalid signature, here is my code."
- "Write an Express endpoint that verifies Byzantine webhooks and updates KYC status."

## Related

- Docs: https://docs.byzantine.fi (MCP: `https://docs.byzantine.fi/mcp`)
- SDK: [`@byzantine/integrator-sdk`](https://www.npmjs.com/package/@byzantine/integrator-sdk)
- Dashboard: https://integrator.byzantine.fi (API keys, webhooks, transactions)

## Contributing

`npm test` runs the script tests and `npm run validate` checks frontmatter, versions and manifests. Bump `version` in `package.json`, every `SKILL.md`, `.claude-plugin/marketplace.json` and `CHANGELOG.md` together; CI fails otherwise.

## License

[Apache-2.0](LICENSE)
