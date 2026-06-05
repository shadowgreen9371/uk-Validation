# 📞 UK Phone Validation Workstation

A browser-based tool to clean old contact packets. Everything runs client-side — no server,
no data leaves the browser.

🌐 **Live:** https://shadowgreen9371.github.io/uk-Validation/

## 3-step workflow

1. **Source** — drop a folder/files; the **exact file contents** are shown first (raw rows,
   detected phone column highlighted). Nothing is changed yet.
2. **Validate** — pick which checks to run (line type, E.164, dedupe, Ofcom block + carrier,
   quality/junk patterns, UK-only) and optionally load TPS/CTPS suppression.
3. **Results** — stats, tabs, searchable table, and CSV exports.

## Local database (storage)

Processed datasets can be **saved to your browser's IndexedDB** — name a run, *Save to
storage*, and reload it later from the **Saved datasets** list without re-uploading or
re-processing. Handles large datasets and never leaves your machine.

## Features

- **Folder & multi-file upload** — drag a folder or pick files; reads inside every `.xlsx`, `.xls`, `.csv`, `.txt`
- **Auto column detection** — finds the phone column whatever it's named
- **UK line-type classification** — Landline / Mobile / VoIP / Premium / Toll-free / Invalid
- **E.164 normalisation** — every number to `+44…`
- **Duplicate removal** — by canonical E.164
- **Ofcom block allocation check** (free, unlimited) — flags numbers whose block isn't
  allocated by Ofcom; those *cannot* be live and are dropped as invalid
- **Local quality / junk-pattern check** (free, offline) — flags numbers that are valid &
  allocated but obviously fake: Ofcom drama/fiction ranges (auto-dropped), all-same digits,
  sequential runs, repeating patterns, `12345678` placeholders, and round switchboard-style
  numbers. Shown in a **Quality** column (✅ OK / 🎭 Reserved / ⚠️ Pattern / 🔵 Round)
- **TPS / CTPS suppression** — load a licensed TPS file; opted-out numbers are flagged
  and excluded from the TPS-safe export (UK compliance)
- **Optional live carrier check** — paste a free Veriphone API key (1,000/month)
- **Export** TPS-safe callable list, landlines, or the full processed set to CSV

## TPS / CTPS Suppression (compliance)

Calling a UK consumer (**TPS**) or business (**CTPS**) registered with the Preference
Service without consent breaches **PECR** and can draw ICO fines. Suppress them three
ways — use any or all:

1. **TPS file** (consumer) — click *Load TPS file*.
2. **CTPS file** (corporate/B2B) — click *Load CTPS file*.
3. **Paid TPS API** — enter your provider's endpoint with `{number}` and `{key}`
   placeholders + the JSON field that signals a hit, then *Auto-check via API*.

You must be **licensed** to hold TPS/CTPS data — this app neither provides nor stores it;
lists stay in your browser. Matches get a 🚫 badge tagged **TPS / CTPS / API**, appear in
the **TPS-registered** tab, and feed the **🚫** stat.

**Export TPS-safe** = valid landlines + mobiles **minus** all suppressed numbers.
(Turn off *Auto-suppress matches* to export everything with `tps_registered` +
`suppress_source` columns instead.)

### Paid TPS API — endpoint examples
```
https://your-provider.com/tps?number={number}&apikey={key}     field: registered
https://api.example.co.uk/v1/check/{number}?key={key}          field: result.tps
```
The app substitutes the placeholders per number, reads the field you name (dot-paths
like `result.tps` work), and treats `true` / `yes` / `1` as registered.

> Lists and API responses stay in your browser. Export adds `tps_registered` (yes/no)
> and `suppress_source` (TPS/CTPS/API) columns.

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

## SQL database export

Push your cleaned data into a real SQL Server database:

1. Create the tables once — run [`database/schema.sql`](database/schema.sql) (SSMS or
   `sqlcmd -S <server> -i database/schema.sql`). It builds `ImportBatch`, `Contacts`
   (every enrichment column + a `raw_data` JSON column for original fields) and a
   `vw_Callable` view (valid + not-suppressed + good-quality + not-dead).
2. In **Results**, name the dataset and click **🗄️ Export SQL** — downloads a `.sql` of
   `INSERT` statements (batched 1,000 rows) ready to run against the schema.
3. For millions of rows, export CSV instead and `BULK INSERT` (see notes in `schema.sql`).

Phone numbers are uniquely indexed (`UX_Contacts_phone`) so the DB dedupes too.
