# Portfolio Hardening Notes

- Security claims must match implemented authentication and authorization checks.
- Encryption claims must match the actual key-management and encryption path.
- File-sharing behavior must be tested for owner, recipient, expired-link, and unauthorized cases.
- Keep production secrets out of Git history and use `.env.example` only for placeholders.
- Keep CI, integration tests, migrations, and documented limitations synchronized.
