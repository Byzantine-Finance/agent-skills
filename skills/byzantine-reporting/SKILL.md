---
name: byzantine-reporting
description: Use when showing Byzantine Finance balances, positions, yield or history to users or back-office teams - get-account-balances (positions, idle balance, pending_withdrawals, price_per_share), vault APY (apy), APY history charts (apy-history), transaction lists (get-transactions, get-all-transactions), portfolio dashboards, or reconciling amounts.
license: Apache-2.0
metadata:
  version: "0.1.3"
---

# Byzantine reporting: balances, yield and history

All reads are signed GETs (`byzantine-api-auth`). A `read_only` key is enough: use one for dashboards, back office and support tools.

## Endpoints

| Need | Call | Key fields |
|---|---|---|
| Portfolio of one account | `GET /v1/query/get-account-balances?accountId=…[&chainId=1\|8453][&includeTestVaults=true]` | `sub_accounts[].positions[]` {`chain_id`, `vault_address`, `is_async_vault`, `asset_address`, `currency` (`eur`/`usd`), `balance`, `shares`, `price_per_share`, `pending_withdrawals?` {`balance`, `shares`}}; `sub_accounts[].idle[]` {`chain_id`, `currency`, `balance`} |
| Vault yield | `GET /v1/query/apy?vault_address=…[&chain_id=…]` (public, no signature) | `apy_12h`, `apy_24h`, `apy_3d`, `apy_7d`, `apy_31d` (ratios: `0.05` = 5 %), `timestamp`, `block_number` |
| Yield chart | `GET /v1/query/apy-history?vault_address=…[&chain_id&start_date&end_date&points&order]` (public) | `data[]` {`timestamp`, `block_number`, `share_price`, `apy_12h` … `apy_31d`} |
| Vault list | `GET /v1/query/top-vaults` | `vault_address`, `chain_id`, `is_active`, `is_asynchronous` |
| Account activity | `GET /v1/query/get-transactions?accountId=…` | all signed transactions of the account (no pagination) |
| All activity | `GET /v1/query/get-all-transactions?limit&offset&order` | `{transactions, total, limit, offset}`, limit 1–100 (default 20) |
| One transaction | `GET /v1/query/get-transaction?transactionId=…` | status, amounts, `transactionHash`, `withdrawalRequest` |

`vault_address` is required; add `chain_id` only when the address is a top vault on several chains (the API answers 400 otherwise). Only active top vaults (`top-vaults`) are covered. `start_date` / `end_date` are RFC 3339 (inclusive, whole seconds). `points` is a maximum count (1–365, default 100), not a frequency: the span is split into equal buckets of at least one hour and the latest snapshot of each non-empty bucket is kept, with no interpolation. The old `apy/{vault_id}` and `history/{vault_id}` routes no longer exist; `limit` / `offset` do not apply to history. Check exact formats with `byzantine-api-generic` (`byz-openapi.mjs list`).

## How to present numbers

- **All amounts are decimal strings.** Parse with a decimal library (or keep strings and format), never `parseFloat` for money maths.
- **Balance** = value of the position in the vault's currency; `shares` and `price_per_share` explain it. Yield shows up as a growing `price_per_share`. Display `balance` rather than recomputing it.
- **Idle balance**: stablecoins sitting in the wallet, not earning. It appears after fiat deposits (conversion leftovers), withdrawals to wallet, or incoming transfers. Offer the user to deposit it.
- **Pending withdrawals**: amounts queued in asynchronous vaults; show them as "being withdrawn", not as available.
- **APY** values are trailing ratios over a fixed window (12 h, 24 h, 3 d, 7 d, 31 d), computed from the price-per-share change; label the window. They are variable, not guaranteed future returns and not an account's own earnings.
- **Totals across currencies**: keep EUR and USD separate unless you convert explicitly.
- Some balance and vault fields are snake_case (`price_per_share`, `vault_address`) while transaction fields are camelCase.

## Transaction rows

Fields: `transactionId`, `accountId`, `chainId`, `vaultAddr`, `type` (`deposit`, `onramp_deposit`, `withdraw`, `withdraw_offramp`, `transfer`, `authorization`, `approve`, `onramp`, `offramp`), `status`, `sourceCurrency`, `destinationCurrency`, `sourceAmount`, `destinationAmount`, `intermediaryAmount`, `transactionHash`, `broadcastedAt`, `createdAt`, `updatedAt`, `withdrawalRequest`, `account {accountName, ownerUserId, imageUrl}`.

User-facing labels that work: `authorization` → "Account activation", `onramp_deposit` → "Bank deposit", `withdraw_offramp` → "Withdrawal to bank", `withdrawal_initiated` → "Withdrawal queued". Hide `authorization`/`approve` rows from end users if they add noise.

Unsigned drafts never appear in these lists.

## Back office

The integrator dashboard (https://integrator.byzantine.fi) already shows customers, transactions (`/transactions?search=<transactionId|hash|accountId>`), webhook deliveries and events: link to it from internal tools instead of rebuilding them.
