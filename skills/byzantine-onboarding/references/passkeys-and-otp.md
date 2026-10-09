# Passkeys and OTP

The end user's passkey is the only thing that can approve a transaction. Byzantine and the integrator cannot sign.

## Create a passkey (browser, SDK)

```ts
import { ByzantineClient } from "@byzantine/integrator-sdk";

const client = new ByzantineClient({
  webauthn: {
    rpId: "example.com",   // your domain; "localhost" in local dev
    rpName: "Example",
    // residentKey: "preferred" (default) → discoverable credential, nothing to store
    // residentKey: "discouraged"          → non-discoverable, you must store credentialId
  },
});

const { attestationData, challengeFromClientData } = await client.webauthn.createPasskey({
  userId: someStableOpaqueId,     // not an email
  userEmail: email,
  userName: displayName,
  challenge: crypto.getRandomValues(new Uint8Array(32)),
});

const authenticator = { authenticatorName: "passkey", challenge: challengeFromClientData, attestation: attestationData };
```

Use `authenticator` in `rootUsers[].authenticators` at account creation, or in `create-authenticators-otp` later.

- `rpId` must match the page's domain (or a parent domain). Passkeys created under one `rpId` cannot sign under another: decide the production domain before go-live.
- Discoverable (default): the user picks their passkey from a list; nothing to store.
- Non-discoverable: store `attestationData.credentialId`; pass `[credentialId]` as the second argument of `client.webauthn.getStamp(payloadString, [credentialId])` when signing.
- Users can have several passkeys (several devices).
- WebAuthn needs a secure context (HTTPS or localhost) and a user gesture (click).

## Sign with the passkey

See `byzantine-money-movement`: `client.webauthn.getStamp(JSON.stringify(bodyToSign))` returns `{ stampHeaderName: "X-Stamp-Webauthn", stampHeaderValue }`; send `stampHeaderValue` as `webAuthnStamp` in the JSON body (not as a header).

## OTP fallback (no passkey yet, invited users)

When a signer was created without `authenticators`, or was invited to an account:

1. `POST /v1/submit/init-otp` `{accountId, userId}` → `{otpId}`; the user receives a code by email.
2. `POST /v1/submit/otp-auth` `{accountId, userId, otpId, otpCode}` → `{sessionId, expiresAt, session}` (session valid ~15 min).
3. Browser: `createPasskey(...)` as above.
4. `POST /v1/submit/create-authenticators-otp` `{sessionId, accountId, userId, authenticators: [authenticator]}` → `{authenticatorIds}`.

An expired or already-used session returns 400: restart at step 1.

## Testing without a frontend

`npx -p @byzantine/integrator-sdk byz-passkey-tool` opens a local page (rpId `localhost`) to enroll a passkey and sign payloads. Accounts created with these passkeys only sign from `localhost`.
