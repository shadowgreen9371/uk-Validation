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

## Ofcom Block + Carrier Check (free)

UK numbers are handed out in *blocks* by Ofcom, and each block is recorded against the
**communications provider** it was given to. From the same free file you get two things:

- **Allocation** — a block Ofcom has never allocated **cannot be a working line**, so it's
  safe junk to drop (auto-flagged invalid).
- **Allocated carrier** — the CP the block was originally assigned to (BT, Sky, Virgin…).
  Note: this is the *original* allocatee, not the current one if the number was later ported
  (porting data is operator-only and not public).

The real Ofcom CSV format (verified) is three columns:
`Communication Provider`, `Number Type`, `Block / Code`. There is **no status column** —
a block listed in the allocated-numbers files *is* allocated.

### Generate / refresh the data

1. Download Ofcom's numbering data (free, no login):
   <https://www.ofcom.org.uk/phones-telecoms-and-internet/information-for-industry/numbering/numbering-data>
   Download the CSV bundle (a `.zip`) and unzip it.
2. Put the `.csv` files in a folder, e.g. `./ofcom-csv/`
3. Run the converter (optionally limit to certain Number Types):
   ```bash
   node scripts/build-ofcom-lookup.mjs ./ofcom-csv ofcom-blocks.json
   # or just geographic + mobile:
   node scripts/build-ofcom-lookup.mjs ./ofcom-csv ofcom-blocks.json GEOGRAPHIC,MOBILE
   ```
4. Commit the generated `ofcom-blocks.json` to the repo root. The app loads it automatically;
   the **Ofcom Block** and **Carrier** columns light up.

> Without `ofcom-blocks.json` the app still works — those two columns just show “—”.
> The converter auto-detects Ofcom's column names, so it survives format tweaks.
> Output is one compact file: `{ lengths, carriers[], map{ prefix → carrierIndex } }`.

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
