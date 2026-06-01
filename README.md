# 📞 Phone Workstation

A lightweight browser tool to parse, validate, deduplicate, and export phone numbers.

## Features

- Paste numbers in any format (spaces, dashes, dots, parentheses, `+`, `00`)
- Validates against E.164 length rules (7–15 digits)
- Normalises to E.164 (`+1234567890`) or keeps original format
- Deduplicates by canonical digits
- Default country fallback for local numbers (US, GB, AU, CA, IN)
- Export valid numbers as CSV or TXT
- Works entirely in the browser — no server, no data sent anywhere

## Deploy to GitHub Pages

### Automatic (CI)

Push to `main` — the workflow in `.github/workflows/deploy.yml` deploys automatically.

**First-time setup:**

1. Go to **Settings → Pages → Source** → select **GitHub Actions**
2. Push any commit to `main`

Your site will be live at:
```
https://<username>.github.io/<repo>/apps/phone-workstation/
```

### Manual

```bash
git clone https://github.com/<username>/<repo>.git
cd <repo>
# Open apps/phone-workstation/index.html in a browser
```

## Project Structure

```
apps/phone-workstation/
├── index.html          # UI layout
├── style.css           # Dark theme, responsive
├── app.js              # Parse → validate → dedup → export logic
└── README.md           # This file

.github/workflows/
└── deploy.yml          # GitHub Pages auto-deploy
```

## Supported Input Formats

| Input | Parsed as |
|---|---|
| `+1 (555) 123-4567` | `+15551234567` |
| `555.123.4567` | `+15551234567` (with US default) |
| `0044 20 7946 0958` | `+442079460958` |
| `07911 123456` | `+447911123456` (with GB default) |
