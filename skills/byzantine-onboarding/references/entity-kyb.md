# Company accounts (KYB)

## Create: `POST /v1/submit/create-entity-account` → 201

Required: `entityInfo` (at least `businessLegalName`), `rootUsers[]` `{firstName,lastName,email,authenticators?}`, `byzantineTermsSignedAt`.
Optional: `entityDocuments`, `associatedPersons`, `walletAddress`, `fiatCurrencies` (`["usd"]`, `["eur"]` or both, default both: USD → `base`, EUR → `sepa`; send only the rails the company will use).

The person creating the account **must also be registered as a beneficiary or representative** (associated person).

Response: `entityId`, `accountId`, `verificationStatus`, `missingCompanyData`, `missingDocuments`, `rootUsers`, `associatedPersons`.

## Complete the company: `PATCH /v1/submit/update-entity-account`

`accountId` + any of `entityInfo` (`businessLegalName`, `businessTradeName`, `businessType`, `companyNumber`, `incorporationDate`, `email`, `phone`, `website`, `otherWebsites`, `logoUrl`, `isDao`, `accountPurpose`, `publiclyTradedListings`, `regulatedActivity`, `registeredAddress`, `physicalAddress`, `activityInfo`, `financialInfo`, `highRiskInfo`), `fiatCurrencies` and `entityDocuments`. The questionnaire entries in `missingDocuments` most likely map to `physicalAddress`, `activityInfo` and `financialInfo`. Check exact sub-fields with `byz-openapi.mjs show update_entity_account`.

`missingCompanyData` values: `business_legal_name`, `business_type`, `company_number`, `website`, `registered_address` (→ `businessLegalName`, `businessType`, `companyNumber`, `website`, `registeredAddress`), and `ASSOCIATED_PERSONS` (no UBO/representative yet).

`missingDocuments` values for companies:

| Value | Documents |
|---|---|
| `COMPANY_DETAILS_DOCUMENT` | Certificate of incorporation, articles of association, registry extract (Kbis / RNE in France) |
| `OWNERSHIP_STRUCTURE_DOCUMENT` | Shareholder registry, trust or partnership agreement, statement of information |
| `SOURCE_OF_FUNDS_DOCUMENT` | Audited financials, bank/brokerage statement, tax return, client invoices |
| `PROOF_OF_ADDRESS_DOCUMENT` | Company proof of address (required before the KYB check starts) |
| `PHYSICAL_ADDRESS_QUESTIONNAIRE`, `ACTIVITY_INFO_QUESTIONNAIRE`, `FINANCIAL_INFO_QUESTIONNAIRE`, `HIGH_RISK_INFO_QUESTIONNAIRE` | `entityInfo.physicalAddress`, `entityInfo.activityInfo`, `entityInfo.financialInfo`, `entityInfo.highRiskInfo` (likely mapping; confirm sub-fields in the spec) |

A power of attorney is needed when a representative is not listed in the registration or ownership documents.

### Company details the fiat rails provider asks for

All optional in the schema, but send them when they apply, they avoid a later request for information:

- `accountPurpose`: `investment_purposes` | `treasury_management` | `protect_wealth` | `other` (`accountPurposeOther` required with `other`).
- `website`: omit it when the company has none and upload a `proof_of_nature_of_business` document instead. A business-registry page (Pappers, Infogreffe, Companies House…) is not a website. Other sites and social handles go in `otherWebsites`.
- `incorporationDate` (`yyyy-mm-dd`) helps the automated registry match. `isDao` defaults to `false`.
- `publiclyTradedListings[]`: `{marketIdentifierCode (ISO 10383, e.g. XPAR), stockNumber (ISIN without dashes), ticker}`, for listed companies.
- `regulatedActivity`: `{regulatedActivitiesDescription, primaryRegulatoryAuthorityCountry, primaryRegulatoryAuthorityName, licenseNumber}`, all four required when present, for licensed businesses.
- `financialInfo.sourceOfFundsDescription`: free text, required for high-risk businesses. `financialInfo.hasMaterialIntermediaryEntityOwner: true` (an intermediate legal entity owns 25 % or more) requires an `ownership_chart` document.
- `highRiskInfo`: `operatesInProhibitedCountries` and `highRiskActivities` (or `["none_of_the_above"]`) are required; `highRiskActivitiesExplanation` is required when any activity is listed. `moneyServices` `{description, conductedThroughAccount, complianceScreeningExplanation}` declares that the company conducts money services: when present all three are required, and `conductedThroughAccount: true` needs a `flow_of_funds` document. `actingAsIntermediary: true` is refused.
- `entityDocuments[].documentType` includes, beyond the table above: `directors_registry`, `good_standing_cert`, `incorporation_articles`, `incorporation_cert`, `incumbency_cert`, `information_statement`, `partnership_agreement`, `power_of_attorney`, `proof_of_nature_of_business`, `shareholder_registry`, `ownership_chart`, `source_of_funds`, `source_of_wealth`, `flow_of_funds`, `regulatory_license`, `aml_policy`, `aml_comfort_letter`, `proof_of_entity_name_change`, `state_registry`, `trust_agreement`, `other`. Optional `issueDate` / `expirationDate` (`yyyy-mm-dd`); a proof of address must be within 90 days.

### Requests from the fiat rails provider (`fiatRequirements`)

`get-entity-details`, `get-account` and `get-account-details` return `fiatRequirements` (nullable): what the fiat rails provider still needs, as last reported by its webhooks. `actionRequired: true` means a field or document is missing on our side or the provider raised an issue. Per rail in `endorsements[]` (`base` for USD, `sepa` for EUR): `missing[]` (`{key, associatedPerson?, hint?}`, flattened labels, not a conjunction: use `missingExpression` for alternatives), `pending` (checks running, nothing to do), `issues` (e.g. `poa_past_90_days`, `pending_rfi`) and `futureRequirements` (items due at an `effectiveDate`). Show it to the user instead of waiting for an email request for information.

## Associated persons (UBOs and representatives)

- Add: `POST /v1/submit/add-associated-person` `{accountId, associatedPerson: {userInfo, beneficiaryDetails, verificationDocuments?}}` → `beneficiaryId`, `missingDocuments`.
- `beneficiaryDetails`: `beneficiaryType`: any combination of `ubo`, `representative`, `director`, `signer`; `ownershipPercentage` required for UBOs (anyone owning 25 % or more directly or indirectly); `title` required for representatives.
- `isSigner` (optional): can this person authorise transactions for the company. Defaults to `true` for representatives and signers, `false` otherwise. A signer who is neither director, owner nor control person needs a `proof_of_signatory_authority` document.
- Update: `PATCH /v1/submit/update-associated-person` with `beneficiaryId` + any subset. `409`: the `title` cannot change while the person is under review.
- Read: `GET /v1/query/get-associated-person-details?beneficiaryId=…` (status + missing documents).
- Every UBO/representative needs ID + proof of address, like an individual.

`awaiting_associated_person_information` means at least one associated person still has to complete their part.

## Timing

KYB typically takes 24–48 h in production (company + every UBO/representative verified). Sandbox approves automatically once the automated checks pass.
