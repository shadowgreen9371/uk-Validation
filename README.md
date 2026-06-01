# 📞 UK Phone Validation Workstation

A browser-based tool to clean old contact packets: **upload a folder of Excel/CSV files →
validate → classify UK line type → remove duplicates → check Ofcom block allocation → export.**
Everything runs client-side — no server, no data leaves the browser.

🌐 **Live:** https://shadowgreen9371.github.io/uk-Validation/

## Features

- **Folder & multi-file upload** — drag a folder or pick files; reads inside every `.xlsx`, `.xls`, `.csv`, `.txt`
- **Auto column detection** — finds the phone column whatever it's named
- **UK line-type classification** — Landline / Mobile / VoIP / Premium / Toll-free / Invalid
- **E.164 normalisation** — every number to `+44…`
- **Duplicate removal** — by canonical E.164
- **Ofcom block allocation check** (free, unlimited) — flags numbers whose block isn't
  allocated by Ofcom; those *cannot* be live and are dropped as invalid
- **Optional live carrier check** — paste a free Veriphone API key (1,000/month)
- **Export** landlines or the full processed set to CSV

## Ofcom Block Allocation Check (free)

UK geographic numbers are handed out in *blocks* by Ofcom. A number sitting in a block Ofcom
has never allocated to any carrier **cannot be a working line** — so it's safe junk to drop.
Ofcom publishes the full allocation list for free; this app reads a compact version of it.

### Generate / refresh the data

1. Download Ofcom's numbering data (free, no login):
   <https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbering-data/>
   Download the **Telephone Numbers / Geographic Numbers** CSV bundle (a `.zip` of CSVs) and unzip it.
2. Put the `.csv` files in a folder, e.g. `./ofcom-csv/`
3. Run the converter:
   ```bash
   node scripts/build-ofcom-lookup.mjs ./ofcom-csv ofcom-blocks.json
   ```
4. Commit the generated `ofcom-blocks.json` to the repo root. The app loads it automatically
   and the **Ofcom Block** column lights up.

> Without `ofcom-blocks.json` the app still works — the allocation column just shows “—”.
> The converter auto-detects Ofcom's column names, so it keeps working when they tweak the format.

## What "active" can and can't mean (honest note)

| Check | Free? | Tells you |
|---|---|---|
| Format + line type (libphonenumber) | ✅ unlimited | Valid UK number, landline vs mobile |
| **Ofcom block allocation** | ✅ unlimited | Block is allocated to a carrier (plausibly live) vs dead |
| Veriphone / AbstractAPI free tier | ⚠️ ~100–1,000/mo | Valid + carrier name |
| True "line is connected & ringing" | ❌ paid only | Requires dialling (Twilio etc.) — regulated by Ofcom in the UK |

There is **no free service** that confirms a landline is physically connected. The combination
of format validation + Ofcom allocation is the strongest free signal available.

## Deploy

Pushing to `main` auto-deploys via `.github/workflows/deploy.yml` (publishes the repo root to
the `gh-pages` branch). Pages **Source** is set to **Deploy from a branch → gh-pages → /(root)**.

## Project structure

```
index.html              # UI
style.css               # Dark theme, responsive
app.js                  # ingest → validate → classify → dedup → allocation → export
ofcom-blocks.json       # (optional) generated Ofcom allocation lookup
scripts/
└── build-ofcom-lookup.mjs   # converts Ofcom CSVs → ofcom-blocks.json
.github/workflows/
└── deploy.yml          # GitHub Pages auto-deploy
```
