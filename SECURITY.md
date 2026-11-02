# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting
(Security tab → Report a vulnerability) or email info@byzantine.fi.

We aim to acknowledge reports within 3 business days.

## Scope

This repository contains agent skills, helper scripts and an MCP configuration
for integrating the Byzantine API. The scripts only sign requests locally, call
the sandbox API, fetch the public OpenAPI spec and check this repository
for a newer version. Never put production keys in a skill or script.
