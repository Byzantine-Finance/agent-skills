# Contributing

Thanks for helping make Byzantine easier to integrate with coding agents.

## Ground rules

- Skills are content, not an app: `skills/<name>/SKILL.md` plus optional `scripts/` and `references/`. The folder name is the skill `name`.
- Facts must match the Byzantine API's actual behaviour. If the docs and the API disagree, the API wins; mention the doc error in the skill.
- Bundled scripts: Node 18+, zero dependencies, secrets from environment variables only, sandbox and dev hosts only (never production).
- Never commit keys, tokens, real customer data or documents.

## Before opening a pull request

```bash
npm run validate && npm test
```

CI also checks that the Claude plugin manifest is valid and that the `skills` CLI lists every skill.

## Versioning

A release bumps the same version in `package.json`, every `SKILL.md` (`metadata.version`) and `.claude-plugin/plugin.json`, and adds a `CHANGELOG.md` entry.

## Security

Do not open public issues for vulnerabilities; see [SECURITY.md](SECURITY.md).
