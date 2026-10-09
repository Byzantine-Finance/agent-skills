---
name: byzantine-onboarding
description: Use when creating or completing Byzantine Finance customer accounts - individual KYC or company KYB, create-individual-account, create-entity-account, update-*-account, associated persons (UBOs, representatives), missingDocuments / missingCompanyData, verification statuses, Terms & Conditions (byzantineTermsSignedAt), creating the user's passkey with the SDK (createPasskey, rpId), OTP fallback, inviting users, roles, or a wealth manager opening an account for a client.
license: Apache-2.0
metadata:
  version: "0.1.0"
---

# Byzantine onboarding: accounts, KYC/KYB and passkeys

Every end user needs a Byzantine **account** (individual or company), a completed **KYC/KYB**, and at least one signer with a **passkey** before any money can move. Requests are signed with the integrator key (`byzantine-api-auth`); writes need a `read_write` key.

## The flow

```
1. User accepts Byzantine T&C in your UI          → keep the timestamp (byzantineTermsSignedAt)
2. Browser: client.webauthn.createPasskey(...)    → attestationData + challengeFromClientData   (recommended now; OTP fallback otherwise)
3. Server:  POST /v1/submit/create-individual-account | create-entity-account   → 201 {accountId, userId|entityId, verificationStatus, missingDocuments, …}
4. Server:  PATCH update-*-account (+ add-associated-person for companies) until missingDocuments (and missingCompanyData) are empty
5. Byzantine starts the check automatically   → customer.* webhooks / poll get-user-details | get-entity-details
6. verificationStatus = active               → activate the account per chain (byzantine-money-movement)
```

Details: `references/individual-kyc.md`, `references/entity-kyb.md`, `references/passkeys-and-otp.md`, `references/mobile-passkeys.md` (iOS / Android / React Native), `references/multi-user-and-roles.md`.

## Minimal individual account

```ts
// browser — rpId must be your app's domain (or "localhost" in dev)
const web = new ByzantineClient({ webauthn: { rpId: "app.example.com", rpName: "Example" } });
const { attestationData, challengeFromClientData } = await web.webauthn.createPasskey({
  userId: crypto.randomUUID(), userEmail: email, userName: `${firstName} ${lastName}`,
  challenge: crypto.getRandomValues(new Uint8Array(32)),
});
// send attestationData + challengeFromClientData to your server

// server
const body = {
  userInfo: { firstName, lastName, email },
  rootUsers: [{ firstName, lastName, email, authenticators: [{
    authenticatorName: "passkey", challenge: challengeFromClientData, attestation: attestationData,
  }] }],
  byzantineTermsSignedAt: termsAcceptedAt.toISOString(),
};
// stamp with client.apiKey.getStamp("POST", "/v1/submit/create-individual-account", JSON.stringify(body))
// then client.api.createIndividualAccount(body, authHeaders)  → 201
```

Same person in `userInfo` and `rootUsers` (same email) for a self-created account.

## Rules

- **One email per integrator.** A second account with the same owner email is rejected. In sandbox tests use `name+test1@…`.
- **Create the passkey before the account** when you can. Without `authenticators`, the user gets OTP-by-email only, and adding a passkey later needs the OTP flow.
- **`rpId` is forever.** Passkeys are bound to the domain used at creation; signing later must use the same `rpId`. Pick the production domain deliberately (a parent domain like `example.com` works for its subdomains).
- **Store `accountId` and `userId`** against your user. Store `attestationData.credentialId` too if you create non-discoverable credentials.
- **Progressive completion.** `update-*-account` is a PATCH: send only what you have; call it as many times as needed. The response always tells you what is still missing.
- **Documents** are `data:<mime>;base64,<data>` strings (jpeg, png, heic, tiff, pdf). Proof of address must be less than 3 months old.
- **Country fields are ISO 3166-1 alpha-3** (`FRA`, `DEU`, `USA`).
- **Do not invent missing-document handling**: map each `missingDocuments` value to a UI step (table in the references).
- Sandbox: approval is automatic once the automated checks pass; production KYC takes minutes, KYB typically 24–48 h.

## Verification statuses (`verificationStatus`)

`not_started`, `init`, `awaiting_information` (data/documents missing), `under_review`, `awaiting_associated_person_information` (a UBO/representative must complete), `resubmission_requested` (fix and resubmit, see `reasonCodes`), `active` (can transact), `rejected` (final), `inactive` (deactivated/deleted). Some doc pages say `waiting_for_information`: the API value is `awaiting_information`.
