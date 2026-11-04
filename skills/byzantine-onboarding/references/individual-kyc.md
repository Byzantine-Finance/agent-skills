# Individual accounts (KYC)

## Create: `POST /v1/submit/create-individual-account` → 201

Required: `userInfo.{firstName,lastName,email}`, at least one `rootUsers[]` entry `{firstName,lastName,email,authenticators?}`, `byzantineTermsSignedAt` (string timestamp of T&C acceptance).

Optional at creation (or later via update): `userInfo.{middleName, phone, birthDate, nationality, nationalities, countryOfBirth, cityOfBirth, residentialAddress, socialSecurityNumber, profilePictureUrl}`, `accountPurpose` (+ `accountPurposeOther`), `fiatCurrencies`, `additionalUserInfo`, `verificationDocuments`, `walletAddress`.

- `userInfo` = the person verified (the customer). `rootUsers` = who can sign. Same person for a normal account.
- `walletAddress` makes the account **self-custodial** (the user brings their own wallet; no embedded wallet is created). Leave it out for the standard embedded passkey wallet.
- Response: `userId`, `accountId`, `verificationStatus` (`awaiting_information` until enough data is in, then `under_review`), `missingDocuments`, `walletAddress`, `rootUsers`.

## Complete: `PATCH /v1/submit/update-individual-account`

Only `accountId` is required. Send any subset of:

- `userInfo`: `phone`, `birthDate`, `nationality` and `countryOfBirth` (ISO alpha-3), `residentialAddress {streetLine1, streetLine2?, city, state?, postalCode, country}`…
  - `nationalities[]`: every nationality held (ISO alpha-3); required by the fiat rails provider for EEA residents. `cityOfBirth`: recommended for EEA residents, required by EU law from 2027.
- `accountPurpose`: `investment_purposes` | `protect_wealth` | `personal_or_living_expenses` | `other`. With `other`, `accountPurposeOther` (free text) is required.
- `fiatCurrencies`: `["usd"]`, `["eur"]` or both (default both). It decides which fiat rails are requested for the customer (USD → `base`, EUR → `sepa`), so send only what the user will use.
- `additionalUserInfo` (the four fields below together, required for high-risk profiles; it also carries `actingAsIntermediary`: `true` is refused, intermediaries are not onboarded): `employmentStatus` (`employed|homemaker|retired|self_employed|student|unemployed`), `expectedMonthlyPaymentsUsd` (`0_4999|5000_9999|10000_49999|50000_plus`), `sourceOfFunds` (`salary`, `savings`, `investments_loans`, `inheritance`, … see spec), `mostRecentOccupation` (6-digit code from the docs' occupation list).
- `verificationDocuments[]`: `{documentType, issuingCountry, document, documentNumber?, description?}`
  - `documentType`: `passport` | `national_id_front` | `national_id_back` | `drivers_license_front` | `drivers_license_back` | `residence_permit_front` | `residence_permit_back` | `proof_of_address` | `proof_of_signatory_authority` | `proof_of_source_of_funds` | `proof_of_source_of_wealth` | `other` (`description` required for `other`).
  - `issueDate` / `expirationDate` (`yyyy-mm-dd`, optional): a proof of address must be issued within the last 90 days; an expired identity document is refused, and the fiat rails provider revokes access when the document on file expires.
  - `documentNumber`: full number, required for passport / national ID.
  - `document`: `data:image/jpeg;base64,…` (jpeg, png, heic, tiff, pdf).
  - Proof of address: utility bill, bank statement, phone bill or tax document, issued less than 3 months ago.

### Example: answer `missingDocuments: ["IDENTITY_DOCUMENT", "PROOF_OF_ADDRESS_DOCUMENT"]`

```json
PATCH /v1/submit/update-individual-account
{
  "accountId": "b1ce3131-…",
  "userInfo": {
    "birthDate": "1990-04-12",
    "nationality": "FRA",
    "residentialAddress": { "streetLine1": "12 rue de Rivoli", "city": "Paris", "postalCode": "75001", "country": "FRA" }
  },
  "verificationDocuments": [
    { "documentType": "national_id_front", "documentNumber": "X4RTBPFW4", "issuingCountry": "FRA", "document": "data:image/jpeg;base64,/9j/4AAQ…" },
    { "documentType": "national_id_back",  "documentNumber": "X4RTBPFW4", "issuingCountry": "FRA", "document": "data:image/jpeg;base64,/9j/4AAQ…" },
    { "documentType": "proof_of_address",  "issuingCountry": "FRA", "document": "data:application/pdf;base64,JVBERi0x…" }
  ]
}
```

Several documents can go in one call; you can also send them one by one. The response repeats `verificationStatus` and the remaining `missingDocuments`. Field formats (e.g. `birthDate`) must match the spec: check with `byz-openapi.mjs show update_individual_account`. Requests are capped at 2 MiB: compress images (or send documents in separate calls).

`issuingCountry`, `nationality`, `countryOfBirth` and address `country` are ISO 3166-1 alpha-3 (`FRA`, `DEU`, `USA`). Enum values are lowercase exactly as listed.

## `missingDocuments` → what to ask the user

| Value | Ask for |
|---|---|
| `RESIDENTIAL_ADDRESS` | Residential address (`userInfo.residentialAddress`) and personal details |
| `ADDITIONAL_USER_INFO` | `additionalUserInfo` (employment, expected volume, source of funds, occupation) |
| `IDENTITY_DOCUMENT` | Passport, or national ID front + back |
| `PROOF_OF_ADDRESS_DOCUMENT` | Proof of address < 3 months |

Other values can appear: show them to the user/support rather than failing. When nothing is missing, the check starts automatically (a few seconds later).

## After submission

Listen to `customer.*` webhooks (`byzantine-webhooks`) or poll `GET /v1/query/get-user-details?userId=…` (also accepts `email`). `resubmission_requested` comes with `reasonCodes`: ask for the fix, PATCH again.
