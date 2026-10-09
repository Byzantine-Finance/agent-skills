# How Byzantine works (for explaining it to humans)

Use this to explain Byzantine accurately. For anything not covered here (legal, regulatory, risk disclosures, pricing details), point to https://docs.byzantine.fi rather than answering from memory.

## In one paragraph

Byzantine lets a platform (the **integrator**: fintech, neobank, B2B platform, wealth manager) offer yield on EUR and USD balances to its own users through an API. The money goes into **Byzantine Prime** smart-contract vaults (USDC and EURC) whose strategy is curated and monitored by Keyrock Curation Services; returns come from third-party lending and are variable, not guaranteed (capital at risk). Byzantine is **non-custodial**: each end user has their own wallet, controlled by their own passkey, and every movement of funds must be approved by that user. Byzantine and the integrator can prepare transactions but can never sign them.

## Actors

| Actor | Role |
|---|---|
| Integrator | Your company. Calls the API with integrator keys, builds the UI, owns the end-user relationship. |
| End user | An individual (KYC) or a company (KYB) using the integrator's app. Owns the funds. |
| Signer (root user) | A person who can approve transactions with their passkey. Usually the end user; for companies or wealth managers, possibly several people. |
| Byzantine | Provides the API, embedded wallets, vaults, transaction building, gas sponsorship. Never holds or controls funds. |
| Partners | Sumsub (identity verification tooling used by Byzantine), Bridge (regulated payment partner: bank on/off-ramp, dedicated bank details, also verifies customers), Keyrock Curation Services (curates and monitors the vault strategy). |

## Objects

- **User** (`userId`): a person. One email per integrator.
- **Entity** (`entityId`): a company, with UBOs and representatives (associated persons, `beneficiaryId`).
- **Account** (`accountId`): what holds money. Individual or company. Has signers with roles and one embedded wallet (or a self-custodial wallet).
- **Wallet**: the account's on-chain address, holding vault shares and idle stablecoins. Upgraded to a smart account at activation (EIP-7702), which enables gas sponsorship.
- **Vault**: a Byzantine Prime smart contract (ERC-4626 style). Deposits get shares; the share price grows with yield. Some vaults are asynchronous: withdrawals are queued and settle later.
- **Transaction** (`transactionId`): a deposit, withdrawal, transfer or activation, with a status lifecycle.

## How money moves

- **In (stablecoins):** idle USDC/EURC in the user's wallet → deposit into a vault (immediate on-chain).
- **In (fiat):** the user signs the deposit first, receives dedicated bank details (virtual account via Bridge), wires the exact amount; once converted, the pre-signed deposit executes.
- **Out:** withdraw from the vault to the wallet (stablecoins) or to a registered bank account (off-ramp to EUR/USD). Async vaults queue the withdrawal; it can be cancelled while pending.
- **Transfer:** send stablecoins from the wallet to any address (irreversible).
- Chains: Ethereum (`1`) and Base (`8453`). Byzantine sponsors gas.
- Currency pairs for fiat deposits: EUR → EURC vault, EUR → USDC vault, USD → USDC vault.

## What is not possible today

- **No automatic sweeping.** An integrator cannot move a user's balance into a vault (or out) in the background: every deposit and withdrawal needs the user's passkey approval at that moment. A "yield on my balance" feature is a user action ("Move €X to savings"), possibly suggested by the app, not an automatic sweep.
- No integrator-held signing key for user funds; no agent or cron job can approve a transaction.

## Why the passkey matters

Every money movement is a two-step flow: the integrator's server asks Byzantine to **build** the transaction, then the **end user approves it with their passkey** on their own device. Without that approval nothing moves. This is what makes the product non-custodial, and it is why an integrator cannot automate deposits/withdrawals in the background.

## Fees

Byzantine takes 10 % of returns; no management, entry or exit fee. Returns displayed are net of this fee. Payment/conversion partners may charge separately (e.g. fiat conversion). Commercial terms between Byzantine and an integrator (revenue share, pricing) are not public: tell the human to ask Byzantine.

## Compliance and timing

- Individuals pass KYC (usually minutes); companies pass KYB (usually 24–48 h, every UBO/representative verified). Byzantine (using Sumsub) and Bridge verify jointly; both may ask for more information.
- End users must accept Byzantine's Terms & Conditions before account creation.
- Regulatory status and risk disclosures: refer to the docs (Asset protection section) and to Byzantine directly; do not paraphrase legal claims.

## Environments

| | Sandbox | Production |
|---|---|---|
| API | `https://sandbox.api.byzantine.fi` | `https://api.byzantine.fi` |
| KYC/KYB | Auto-approved after automated checks | Real review |
| Money | No real fiat; no payment webhooks | Real funds |
| Keys | Sandbox keys only | Production keys only |

Integrator dashboard (keys, customers, transactions, webhooks): https://integrator.byzantine.fi
