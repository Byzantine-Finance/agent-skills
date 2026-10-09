# Passkeys in native mobile apps (iOS, Android, React Native)

`@byzantine/integrator-sdk`'s `client.webauthn` only runs in a browser (it calls `navigator.credentials`). There is no Byzantine native SDK. Native apps use the platform passkey APIs and must produce **exactly the same data** the SDK produces. Validate every step in sandbox before shipping.

## Prerequisites

- The passkey `rpId` is your domain (e.g. `example.com`). The app must be associated with it:
  - iOS: Associated Domains entitlement `webcredentials:example.com` + `https://example.com/.well-known/apple-app-site-association` listing the app.
  - Android: `https://example.com/.well-known/assetlinks.json` with `delegate_permission/common.get_login_creds` for the app's signing certificate.
- Use the same `rpId` on web and mobile if users use both: passkeys created under one `rpId` cannot sign under another.
- APIs: iOS `ASAuthorizationPlatformPublicKeyCredentialProvider`; Android Credential Manager (`CreatePublicKeyCredentialRequest` / `GetPublicKeyCredentialOption`); React Native via a passkey library wrapping both (e.g. `react-native-passkey`), or a WebView/browser hand-off to a web page that uses the SDK.

## Registration (account creation or `create-authenticators-otp`)

Send an `authenticator` built from the platform's registration result:

```json
{
  "authenticatorName": "passkey",
  "challenge": "<the challenge exactly as it appears in clientDataJSON (base64url)>",
  "attestation": {
    "credentialId": "<rawId, base64url>",
    "clientDataJson": "<clientDataJSON bytes, base64url>",
    "attestationObject": "<attestationObject bytes, base64url>",
    "transports": ["AUTHENTICATOR_TRANSPORT_INTERNAL", "AUTHENTICATOR_TRANSPORT_HYBRID"]
  }
}
```

Request ES256 (`alg: -7`) and RS256 (`-257`) like the SDK; attestation "none" is fine. The SDK sends `challengeFromClientData` = the `challenge` field read back from `clientDataJSON`. Transport names follow the API enum (check with `byz-openapi.mjs schema Transports`).

## Signing a transaction (`webAuthnStamp`)

1. `payload = JSON.stringify(bodyToSign)` (the exact string your server got from the API — pass it to the app as a string).
2. `challenge = UTF-8 bytes of hex(SHA-256(payload))` — the 64-character lowercase hex string, encoded as bytes (this is what the SDK's `getStamp` does).
3. Run a passkey assertion with `rpId` and that challenge (optionally `allowCredentials` with the stored credential id).
4. Build the stamp as a JSON string, all values base64url:

```json
{"credentialId":"…","authenticatorData":"…","clientDataJson":"…","signature":"…"}
```

5. Send that string as `webAuthnStamp` to your server, which calls `sign-payload-passkey`.

If the API answers 500 `"Turnkey API error …"`, the stamp did not verify: check the challenge derivation (hash of the exact payload string, hex, then bytes), base64url (no padding), and that the passkey's `rpId` matches.

## Simplest path

If native passkeys are not a priority, open a small web page (in-app browser / ASWebAuthenticationSession / Custom Tab) hosted on your `rpId` domain that runs the SDK for `createPasskey` and `getStamp`, and returns the result to the app. It reuses the web code exactly.
