---
name: byzantine-reporting
description: Use when showing Byzantine Finance balances, positions, yield or history to users or back-office teams - get-account-balances (positions, idle balance, pending_withdrawals, price_per_share), vault APY (apy/{vault_id}), share price history charts (history/{vault_id}), transaction lists (get-transactions, get-all-transactions), portfolio dashboards, or reconciling amounts.
license: Apache-2.0
metadata:
  version: "0.1.2"
---

# Byzantine reporting: balances, yield and history

All reads are signed GETs (`byzantine-api-auth`). A `read_only` key is enough: use one for dashboards, back office and support tools.

## Endpoints

| Need | Call | Key fields |
|---|---|---|
| Portfolio of one account | `GET /v1/query/get-account-balances?accountId=…[&chainId=1\|8453][&includeTestVaults=true]` | `sub_accounts[].positions[]` {`chain_id`, `vault_address`, `is_async_vault`, `asset_address`, `currency` (`eur`/`usd`), `balance`, `shares`, `price_per_share`, `pending_withdrawals?` {`balance`, `shares`}}; `sub_accounts[].idle[]` {`chain_id`, `currency`, `balance`} |
| Vault yield | `GET /v1/query/apy/{vault_id}[?period=…]` | `daily_apy`, `weekly_apy`, `monthly_apy`, `yearly_apy`, `*_period_days`, `latest_share_price`, `calculated_at` |
| Yield chart | `GET /v1/query/history/{vault_id}?start_date&end_date&limit&offset&order` | `data[]` {`timestamp`, `share_price`, `total_assets`, `hourly_apy`} (hourly), `total_count` |
| Vault list | `GET /v1/query/top-vaults` | `vault_address`, `chain_id`, `is_active`, `is_asynchronous` |
| Account activity | `GET /v1/query/get-transactions?accountId=…` | all signed transactions of the account (no pagination) |
| All activity | `GET /v1/query/get-all-transactions?limit&offset&order` | `{transactions, total, limit, offset}`, limit 1–100 (default 20) |
| One transaction | `GET /v1/query/get-transaction?transactionId=…` | status, amounts, `transactionHash`, `withdrawalRequest` |

`vault_id` is the vault address. Check exact parameter formats (dates, `period` values) with `byzantine-api-generic` (`byz-openapi.mjs show get_vault_history`).

## How to present numbers

- **All amounts are decimal strings.** Parse with a decimal library (or keep strings and format), never `parseFloat` for money maths.
- **Balance** = value of the position in the vault's currency; `shares` and `price_per_share` explain it. Yield shows up as a growing `price_per_share`. Display `balance` rather than recomputing it.
- **Idle balance**: stablecoins sitting in the wallet, not earning. It appears after fiat deposits (conversion leftovers), withdrawals to wallet, or incoming transfers. Offer the user to deposit it.
- **Pending withdrawals**: amounts queued in asynchronous vaults; show them as "being withdrawn", not as available.
- **APY** values are numbers over a lookback window (`*_period_days`); label the window. Returns are variable and net of Byzantine's fee: do not present them as guaranteed.
- **Totals across currencies**: keep EUR and USD separate unless you convert explicitly.
- Some balance and vault fields are snake_case (`price_per_share`, `vault_address`) while transaction fields are camelCase.

## Transaction rows

Fields: `transactionId`, `accountId`, `chainId`, `vaultAddr`, `type` (`deposit`, `onramp_deposit`, `withdraw`, `withdraw_offramp`, `transfer`, `authorization`, `approve`, `onramp`, `offramp`), `status`, `sourceCurrency`, `destinationCurrency`, `sourceAmount`, `destinationAmount`, `intermediaryAmount`, `transactionHash`, `broadcastedAt`, `createdAt`, `updatedAt`, `withdrawalRequest`, `account {accountName, ownerUserId, imageUrl}`.

User-facing labels that work: `authorization` → "Account activation", `onramp_deposit` → "Bank deposit", `withdraw_offramp` → "Withdrawal to bank", `withdrawal_initiated` → "Withdrawal queued". Hide `authorization`/`approve` rows from end users if they add noise.

Unsigned drafts never appear in these lists.

## Back office

The integrator dashboard (https://integrator.byzantine.fi) already shows customers, transactions (`/transactions?search=<transactionId|hash|accountId>`), webhook deliveries and events: link to it from internal tools instead of rebuilding them.
