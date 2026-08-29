# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

---

## Reporting a Vulnerability

We take the security of **Task-Laureate** and user data privacy seriously. If you discover a security vulnerability, please report it responsibly:

1. **Do not create a public GitHub issue.**
2. Send an email to the maintainer: **`security@ai-aarti.com`** or contact **Aarti S Ravikumar** directly.
3. Include detailed steps to reproduce the vulnerability, along with proof-of-concept code or network payloads if applicable.

### What to Expect:
- **Acknowledgement**: Within 48 hours.
- **Triage & Remediation**: We will investigate and provide an estimated timeline for a patch.
- **Public Disclosure**: Coordinated after the fix has been deployed and verified.

---

## Security Architecture & Design

- **PostgreSQL Row-Level Security (RLS)**:
  - Strict tenant and workspace data isolation at the database layer.
  - Granular `owner`, `editor`, and `viewer` role enforcement across all list items and task attachments.
- **PKCE Authentication Flow**:
  - Secure authorization code exchange with Proof Key for Code Exchange (RFC 7636) to prevent authorization code interception attacks.
- **Content Security & Sanitization**:
  - Rich text notes and external markdown inputs are strictly sanitized to prevent Cross-Site Scripting (XSS).
- **Privacy-Gated Telemetry**:
  - Telemetry and diagnostics require explicit user opt-in and are anonymized. No task content, titles, or notes are ever logged.
- **Client-Side Encryption Ready**:
  - Local persistence stores state in local storage/IndexedDB with structured serialization guards.
