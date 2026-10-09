# Multi-user accounts, invitations and roles

## Who is who

- `userInfo` / `entityInfo`: **who is verified** (the customer).
- `rootUsers`: **who can sign**, each with their own passkey.
- Roles: `root` (can sign deposits/withdrawals and approve changes), `admin`, `view` (read only), `beneficiary`, `self_custodial`. Read them in `get-account-details` → `users[].role`.

Company accounts are multi-user by design. Individual accounts can also have several signers.

## Wealth manager / CGP opening an account for a client

Create an individual account with the **client in `userInfo`** (KYC subject, customer from day one) and the **wealth manager in `rootUsers`** (signer with their passkey). Later, invite the client as a signer; once they are `root`, they can demote the manager to `view`.

## Inviting users (signed by an existing root's passkey)

1. `POST /v1/query/get-invite-users-payload-passkey` `{accountId, newUsers: [{firstName, lastName, userEmail}]}` → `{bodyToSign}`.
2. Browser: the inviting root signs `JSON.stringify(bodyToSign)` with `client.webauthn.getStamp`.
3. `POST /v1/submit/invite-users` `{signedBody: bodyToSign, invitedBy: <inviter userId>, webAuthnStamp}` → `{newUsers[{userId,…}], invitedAt}`.

Invited users who have no KYC yet are emailed to complete it. They then accept with the OTP flow and create a passkey (`passkeys-and-otp.md`).

List invitations: `get-invitations-by-account-id`, `get-invitations-by-email`, `get-all-invitations` (paginated).

## Changing roles (approved by the current root quorum)

1. `POST /v1/query/get-update-users-role-payload-passkey` `{accountId, role, userIds}` → `{bodyToSign}`.
2. A root signs it with their passkey.
3. `POST /v1/submit/update-users-role` `{signedBody, webAuthnStamp}` → `{accountId, threshold, rootUserIds}`.

Note: invitations and role changes use their own submit endpoints, not `sign-payload-passkey`.

## One person, several accounts

A user can belong to several accounts (their own individual account plus companies they were invited to). `get-user-details` returns `accounts[]`; each account has its own wallet, balances and roles. Always pass the right `accountId`.
