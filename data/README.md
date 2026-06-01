# Philippines BPO Directory

`philippines-bpo-directory.csv` — Philippine call centres / BPOs that **publicly advertise
outbound B2C and UK/Western-market telemarketing**. Compiled from the companies' own
websites and public BPO directories only.

## Columns

| Column | Meaning |
|---|---|
| `company` | Business name |
| `location` | PH delivery site(s) |
| `website` | Official site (verify here — directory rankings are often pay-to-rank) |
| `services` | Publicly stated service lines |
| `serves_uk` | `yes` if the site explicitly lists UK clients/market; else `unknown` |
| `source` | Where the entry came from |
| `notes` | Public facts (years, certs, client regions) |

## Important caveats

- **This is "advertises UK/B2C capability", NOT "running a UK campaign now."** Who is
  dialling which live campaign is private operational data — it is **not** public anywhere.
- **No LinkedIn data.** LinkedIn is auth-walled and scraping breaches its ToS; research
  specific staff/clients manually while logged in yourself.
- **Verify on each company's own website.** "Top 10" directory lists are frequently paid placements.
- Add your own rows freely — it's a plain CSV.

## Compliance note (UK B2C calling)

Any operation calling UK consumers — onshore or offshore (incl. Philippines) — must follow
UK **PECR** and screen against **TPS/CTPS**, and honour opt-outs, or risk ICO enforcement.
