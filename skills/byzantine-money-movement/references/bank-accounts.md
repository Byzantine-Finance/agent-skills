# Bank accounts and off-ramp withdrawals

A withdrawal to a bank (EUR via SEPA, USD via ACH) needs a bank account registered on the Byzantine account first. KYC/KYB must be complete.

## Add: `POST /v1/submit/add-bank-account` → 201

```json
{
  "accountId": "…",
  "currency": "eur",
  "label": "Main account",
  "ibanBankAccountDetails": { "accountNumber": "FR76…", "bic": "…", "country": "FRA", "bankName": "…" }
}
```

- EUR: `ibanBankAccountDetails` `{accountNumber (IBAN), bic, country (ISO alpha-3), bankName?}`.
- USD: `achBankAccountDetails` `{bankName, accountNumber, routingNumber, checkingOrSavings: "checking"|"savings"|"unknown"}`.
- Response: `{bankAccountId, accountId, name, liquidationAddress, createdAt, destinationCurrency, destinationRail: "sepa"|"ach"|…}`.

This sets where money can leave to: treat it as sensitive (confirm with the user, show the IBAN back, log who added it).

## List: `GET /v1/query/get-bank-accounts?accountId=…[&currency=eur]`

Also included in `get-account-details` → `bankAccounts[]`. Several bank accounts per account are allowed: let the user pick one.

## Withdraw to the bank

`get-withdraw-payload-passkey` with `destinationCurrency: "eur"|"usd"` and `bankAccountId` → passkey → `sign-payload-passkey`. Statuses: `processing → waiting_for_funds → funds_received → completed` (or `refunded`). Asynchronous vaults may first return 202 `withdrawal_initiated`.

Errors: 400 `"bankAccountID field is required for fiat withdrawals"`, 400 `"Account has no Bridge customer yet"` (KYC/KYB not finished), 400 `"Bank account not found"` (wrong id or other account).
