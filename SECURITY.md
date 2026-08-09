# Security Notes

This project is a portfolio implementation and should not be treated as a production cloud-storage service without independent security review.

## Required production controls

- Keep all secrets outside Git history and provide only placeholders in `.env.example`.
- Enforce authentication and resource ownership on every file and share endpoint.
- Use short-lived signed tokens and rotate/revoke refresh sessions.
- Validate file size, filename, MIME type, and upload content before persistence.
- Never expose storage paths or internal exception details to clients.
- Verify share ownership, recipient authorization, and link expiry server-side.
- Encrypt data in transit and at rest; document the actual key-management design.
- Run dependency scanning, secret scanning, unit tests, and integration tests in CI.

## Reporting a vulnerability

Do not publish credentials, tokens, private files, or exploit details in a public issue. For this portfolio repository, report concerns privately to the repository owner.
