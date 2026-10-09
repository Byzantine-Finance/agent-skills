# Company accounts (KYB)

## Create: `POST /v1/submit/create-entity-account` → 201

Required: `entityInfo` (at least `businessLegalName`), `rootUsers[]` `{firstName,lastName,email,authenticators?}`, `byzantineTermsSignedAt`.
Optional: `entityDocuments`, `associatedPersons`, `walletAddress`.

The person creating the account **must also be registered as a beneficiary or representative** (associated person).

Response: `entityId`, `accountId`, `verificationStatus`, `missingCompanyData`, `missingDocuments`, `rootUsers`, `associatedPersons`.

## Complete the company: `PATCH /v1/submit/update-entity-account`

`accountId` + any of `entityInfo` (`businessLegalName`, `businessTradeName`, `businessType`, `companyNumber`, `email`, `website`, `logoUrl`, `registeredAddress`, `physicalAddress`, `activityInfo`, `financialInfo`, `highRiskInfo`) and `entityDocuments`. The questionnaire entries in `missingDocuments` most likely map to `physicalAddress`, `activityInfo` and `financialInfo`. Check exact sub-fields with `byz-openapi.mjs show update_entity_account`.

`missingCompanyData` values: `business_legal_name`, `business_type`, `company_number`, `website`, `registered_address` (→ `businessLegalName`, `businessType`, `companyNumber`, `website`, `registeredAddress`), and `ASSOCIATED_PERSONS` (no UBO/representative yet).

`missingDocuments` values for companies:

| Value | Documents |
|---|---|
| `COMPANY_DETAILS_DOCUMENT` | Certificate of incorporation, articles of association, registry extract (Kbis / RNE in France) |
| `OWNERSHIP_STRUCTURE_DOCUMENT` | Shareholder registry, trust or partnership agreement, statement of information |
| `SOURCE_OF_FUNDS_DOCUMENT` | Audited financials, bank/brokerage statement, tax return, client invoices |
| `PROOF_OF_ADDRESS_DOCUMENT` | Company proof of address (required before the KYB check starts) |
| `PHYSICAL_ADDRESS_QUESTIONNAIRE`, `ACTIVITY_INFO_QUESTIONNAIRE`, `FINANCIAL_INFO_QUESTIONNAIRE` | `entityInfo.physicalAddress`, `entityInfo.activityInfo`, `entityInfo.financialInfo` (likely mapping; confirm sub-fields in the spec) |

A power of attorney is needed when a representative is not listed in the registration or ownership documents.

## Associated persons (UBOs and representatives)

- Add: `POST /v1/submit/add-associated-person` `{accountId, associatedPerson: {userInfo, beneficiaryDetails, verificationDocuments?}}` → `beneficiaryId`, `missingDocuments`.
- `beneficiaryDetails`: `beneficiaryType: ["ubo"] | ["representative"] | ["ubo","representative"]`; `ownershipPercentage` required for UBOs (anyone owning > 25 % directly or indirectly); `title` required for representatives.
- Update: `PATCH /v1/submit/update-associated-person` with `beneficiaryId` + any subset.
- Read: `GET /v1/query/get-associated-person-details?beneficiaryId=…` (status + missing documents).
- Every UBO/representative needs ID + proof of address, like an individual.

`awaiting_associated_person_information` means at least one associated person still has to complete their part.

## Timing

KYB typically takes 24–48 h in production (company + every UBO/representative verified). Sandbox approves automatically once the automated checks pass.
