# Security Policy

## Scope

This project handles sensitive information including:
- Crisis disclosures (domestic violence, suicidal ideation, child abuse)
- Household financial data (income, benefits status)
- Client identifiers (internal IDs only — never PII)

## Data Handling

- **No PII in the tool.** The Client ID field is for internal identifiers only. Never enter names, SSNs, dates of birth, or addresses into the screening form.
- **No server-side storage.** The React component runs entirely client-side. Screening data is held in browser memory and optionally in `localStorage`. It is never transmitted to a server by this tool.
- **localStorage.** If session persistence is enabled, partial screening data is stored in the browser's `localStorage`. This data persists until the user completes or resets the screening. Users on shared computers should reset the screening when done.
- **Clipboard.** The "Copy Report" feature writes to the system clipboard. Users should be aware that clipboard contents may be accessible to other applications.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not open a public issue.** Security issues should not be disclosed publicly until a fix is available.
2. **Email the maintainers** with a description of the vulnerability, steps to reproduce, and potential impact.
3. We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## Crisis Resources

If you or someone you know is in immediate danger:
- **Emergency:** 911
- **Suicide & Crisis Lifeline:** 988
- **Domestic Violence Hotline:** 1-800-799-7233
- **Child Abuse Hotline (Missouri):** 1-800-392-3738
