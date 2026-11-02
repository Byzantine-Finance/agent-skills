# What KYC and KYB expect (explain this to the user)

Use this page when a user asks "why do you need this?", "what will I have to provide?" or "how long will it take?", and before collecting any data. Sources: docs.byzantine.fi (KYC and KYB, Required documents, Identity verification - organisation, Verification statuses).

## Why it exists

KYC (people) and KYB (companies) are anti-money-laundering requirements: establish who the customer is, where the funds come from, and what activity to expect. Byzantine and its regulated payment partner (Bridge) verify jointly, and **either may ask for more details** during the process. Screening covers sanctions lists, politically exposed persons (PEP) and, for companies, adverse media; monitoring continues after approval. Nobody can deposit before the account is `active`.

## Individual (KYC)

| Expected | Notes |
|---|---|
| Identity | Passport, or national ID **front and back** |
| Proof of address | Utility bill, recent bank statement, mobile phone bill or tax document, **issued less than 3 months ago** |
| Personal details | Birth date, nationality, country of birth, residential address (ISO alpha-3 countries) |
| Profile questions (`additionalUserInfo`) | Employment status, expected monthly volume, source of funds, occupation. Needed for high-risk profiles; all four together |
| Terms | The user accepts the Byzantine Terms and Conditions; keep the timestamp |

Typical duration: a few minutes once everything is submitted.

## Company (KYB)

A company is verified together with **every person behind it**.

1. **Company data**: legal name, type, registration number, registered address, website (optional). In the dashboard these are pre-filled from official registries.
2. **Four document groups, at least one document in each**: company details (certificate of incorporation, articles, registry extract such as Kbis/RNE), ownership structure (shareholder registry, trust or partnership agreement, statement of information), source of funds (audited financials, bank/brokerage statement, tax return, client invoices), proof of the company's physical address (in the company's name: utility bill, lease, bank statement, government or tax letter).
3. **Questionnaires**: physical address if different from the registered one, business activity (a clear description of what the company does), financial information (source of funds, estimated income, expected monthly flows, whether another legal entity owns 25 % or more). The dashboard options for source of funds are business revenues or investment income, third-party funds, owner's capital, savings.
4. **People**: every UBO (individual owning 25 % or more, directly or indirectly) and every representative (anyone who can legally decide for the company). **The person creating the account must be one of them.**
5. **Each associated person completes their own KYC.** The team can fill in the forms, but the beneficial owners must complete the final identity verification (facial recognition) themselves.

Typical duration: 24 to 48 hours once all documents and all individual verifications are in.

### Rules people get wrong

- **List individuals, not companies, as UBOs.** If Company A (John 50 %, Marie 50 %) owns 50 % of the client, list John 25 % and Marie 25 % (via Company A).
- **No website** (holding, family office): leave it empty and expect to be asked for extra proof of funds (bank statements or balance sheet).
- **Holding company / family office**: describe it plainly (for example "Holding company managing family assets. No commercial activity."), industry "Offices of other holding companies".
- **A representative missing from the registration or ownership documents** needs a power of attorney.
- **Wealth manager opening an account for a client**: the client's team gets roles (Admin can move funds; Viewer can read and can complete the verification paperwork). Beneficial owners still do their own identity check.

## Statuses, in plain words

| `verificationStatus` | Tell the user |
|---|---|
| `awaiting_information` | Something is missing; read `missingDocuments` / `missingCompanyData` and ask for exactly that |
| `awaiting_associated_person_information` | A UBO or representative has not finished their own verification |
| `under_review` | All data received; the review is running, nothing to do |
| `resubmission_requested` | Fixable problem (`reasonCodes`): correct it and resubmit |
| `active` | Approved; the account can be activated and funded |
| `rejected` | Final: do not retry or work around it, point the user to Byzantine support |
| `inactive` | Deactivated or deleted |

## How an agent should behave

- **Ask the user for every value and document.** Never invent, guess, reuse another person's data or generate documents. In production these are real people and real regulatory records.
- **Never promise approval or a deadline.** Give the typical durations above as typical.
- **Keep PII out of logs, commits and chat transcripts**: no base64 documents or ID numbers in files you write or output you echo.
- **Send what the user gave you, consistently** (the same spelling of names and addresses as on the documents); mismatches are the usual cause of `resubmission_requested`.
- **Sandbox is not production**: sandbox approves automatically once automated checks pass. Do not tell the user their production timing or outcome from a sandbox run.
