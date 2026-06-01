#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   build-ofcom-lookup.mjs
   Converts Ofcom's official telephone numbering CSVs into a compact
   `ofcom-blocks.json` the workstation loads for free, unlimited:
     • block-allocation check  (is this number's block allocated → could be live?)
     • allocated-carrier lookup (which CP was the block given to: BT, Sky, …)

   ── VERIFIED Ofcom CSV format (June 2026) ───────────────────────────────
   Columns:  "Communication Provider" , "Number Type" , "Block / Code"
   Example rows:
       BT ,GEOGRAPHIC ,20 7946          -> London block,  prefix 207946
       EE ,MOBILE     ,7488 0           -> mobile block,  prefix 74880
   There is NO status column: a block listed in the allocated-numbers files
   IS allocated. (Feed this script the allocated files, not the "free" list.)

   ── HOW TO USE ──────────────────────────────────────────────────────────
   1. Download Ofcom numbering data (free, no login):
        https://www.ofcom.org.uk/phones-telecoms-and-internet/information-for-industry/numbering/numbering-data
      Download the CSV bundle (a .zip) and unzip it.
   2. Put the .csv files in a folder, e.g.  ./ofcom-csv/
   3. Run:  node scripts/build-ofcom-lookup.mjs ./ofcom-csv ofcom-blocks.json
      (optional 3rd arg: comma-separated Number Types to keep,
       e.g.  ... ofcom-blocks.json GEOGRAPHIC,MOBILE )
   4. Commit ofcom-blocks.json — the app loads it automatically.

   Output shape (one file, powers both features):
     { generated, lengths:[descending prefix lengths],
       carriers:[unique CP names], map:{ "<prefix>": <carrierIndex> } }
   A prefix present in `map` == allocated; its value indexes `carriers`.
   ═══════════════════════════════════════════════════════════════════════ */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const inputDir   = process.argv[2] || './ofcom-csv';
const outputFile = process.argv[3] || 'ofcom-blocks.json';
const typeFilter = (process.argv[4] || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

// ── tiny CSV parser (quotes + commas) ─────────────────────────────────────
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false; else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
function findCol(headers, candidates) {
  const H = headers.map(norm);
  for (const c of candidates) { const i = H.findIndex(h => h === norm(c)); if (i !== -1) return i; }
  for (const c of candidates) { const i = H.findIndex(h => h.includes(norm(c))); if (i !== -1) return i; }
  return -1;
}

const carriers = [];                 // unique CP names
const carrierIndex = new Map();      // name -> idx
const map = new Map();               // prefix -> carrier idx
const lengths = new Set();
let files = 0, rows = 0, kept = 0;

const csvs = readdirSync(inputDir).filter(f => extname(f).toLowerCase() === '.csv');
if (!csvs.length) {
  console.error(`No .csv files in ${inputDir}. Download + unzip Ofcom numbering data first.`);
  process.exit(1);
}

for (const file of csvs) {
  const full = join(inputDir, file);
  if (!statSync(full).isFile()) continue;
  const parsed = parseCSV(readFileSync(full, 'utf8'));
  if (parsed.length < 2) continue;
  files++;

  const headers = parsed[0];
  const cpIdx    = findCol(headers, ['communication provider', 'communications provider', 'provider', 'allocatee']);
  const typeIdx  = findCol(headers, ['number type', 'type']);
  const blockIdx = findCol(headers, ['block / code', 'block/code', 'block', 'code', 'sabc']);
  if (blockIdx === -1) { console.warn(`  ! ${file}: no Block/Code column, skipped`); continue; }

  for (let r = 1; r < parsed.length; r++) {
    const cells = parsed[r];
    if (!cells || !cells.length) continue;
    rows++;

    if (typeFilter.length && typeIdx !== -1) {
      const t = String(cells[typeIdx] || '').trim().toUpperCase();
      if (!typeFilter.some(f => t.includes(f))) continue;
    }

    const prefix = String(cells[blockIdx] || '').replace(/\D/g, ''); // strip space etc.
    if (prefix.length < 3) continue;

    const cp = cpIdx !== -1 ? String(cells[cpIdx] || '').trim() : '';
    let idx = carrierIndex.get(cp);
    if (idx === undefined) { idx = carriers.length; carriers.push(cp); carrierIndex.set(cp, idx); }

    map.set(prefix, idx);
    lengths.add(prefix.length);
    kept++;
  }
  console.log(`  ✓ ${file}`);
}

const out = {
  generated: new Date().toISOString(),
  lengths: [...lengths].sort((a, b) => b - a),   // longest-first for matching
  carriers,
  map: Object.fromEntries(map),
};
writeFileSync(outputFile, JSON.stringify(out));
const sizeMB = (statSync(outputFile).size / 1048576).toFixed(2);

console.log('\n─────────────────────────────────────────────');
console.log(`Files processed : ${files}`);
console.log(`Rows scanned    : ${rows.toLocaleString()}`);
console.log(`Blocks kept     : ${kept.toLocaleString()}`);
console.log(`Carriers        : ${carriers.length.toLocaleString()}`);
console.log(`Prefix lengths  : ${out.lengths.join(', ')}`);
console.log(`Output          : ${outputFile} (${sizeMB} MB)`);
if (typeFilter.length) console.log(`Type filter     : ${typeFilter.join(', ')}`);
console.log('Done. Commit this file — the app uses it automatically.');
