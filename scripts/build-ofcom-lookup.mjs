#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   build-ofcom-lookup.mjs
   Converts Ofcom's official telephone numbering allocation CSVs into a
   compact `ofcom-blocks.json` that the workstation loads for free,
   unlimited "is this number block allocated?" checks.

   ── HOW TO USE ──────────────────────────────────────────────────────────
   1. Download Ofcom's numbering data (free, no login):
        https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbering-data/
      Grab the "Telephone Numbers" / "Geographic Numbers" CSV download
      (a .zip of CSV sheets). Unzip it.
   2. Put all the .csv files into a folder, e.g.  ./ofcom-csv/
   3. Run:  node scripts/build-ofcom-lookup.mjs ./ofcom-csv  ofcom-blocks.json
   4. Commit the generated ofcom-blocks.json — the app picks it up automatically.

   The script is column-name tolerant: it auto-detects the area-code,
   block and status columns whatever Ofcom name them this year.
   ═══════════════════════════════════════════════════════════════════════ */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const inputDir   = process.argv[2] || './ofcom-csv';
const outputFile = process.argv[3] || 'ofcom-blocks.json';

// Status values that mean the block is genuinely in carrier use.
const ALLOCATED_HINTS = ['allocated', 'in use', 'live', 'assigned'];
// Status values that mean the block is NOT usable (dead).
const DEAD_HINTS = ['free', 'unallocated', 'protected', 'reserved', 'designated', 'withdrawn', 'quarantine'];

// ── tiny CSV parser (handles quotes + commas) ─────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

function findCol(headers, candidates) {
  const H = headers.map(norm);
  for (const cand of candidates) {
    const idx = H.findIndex(h => h === norm(cand));
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = H.findIndex(h => h.includes(norm(cand)));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ── collect allocated block prefixes keyed by length ──────────────────────
const prefixesByLen = new Map();   // length -> Set(prefix)
let totalRows = 0, allocatedRows = 0, files = 0;

const entries = readdirSync(inputDir).filter(f => extname(f).toLowerCase() === '.csv');
if (!entries.length) {
  console.error(`No .csv files found in ${inputDir}`);
  console.error('Download Ofcom numbering data, unzip, and point this script at the folder.');
  process.exit(1);
}

for (const file of entries) {
  const full = join(inputDir, file);
  if (!statSync(full).isFile()) continue;
  const rows = parseCSV(readFileSync(full, 'utf8'));
  if (rows.length < 2) continue;
  files++;

  const headers = rows[0];
  const codeIdx  = findCol(headers, ['sabc', 'areacode', 'area code', 'code', 's5', 'dialcode']);
  const blockIdx = findCol(headers, ['block', 'thousand', 'range', 'sub block', 'subblock', 'number']);
  const statIdx  = findCol(headers, ['status', 'allocation', 'availability', 'state']);

  if (codeIdx === -1) { console.warn(`  ! ${file}: no area-code column found, skipped`); continue; }

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || !cells.length) continue;
    totalRows++;

    const status = statIdx !== -1 ? norm(cells[statIdx]) : '';
    // Decide allocated/dead. If no status column, assume listed = allocated.
    let allocated;
    if (status) {
      if (DEAD_HINTS.some(h => status.includes(norm(h)))) allocated = false;
      else if (ALLOCATED_HINTS.some(h => status.includes(norm(h)))) allocated = true;
      else allocated = true; // unknown status but listed -> treat as in use
    } else allocated = true;
    if (!allocated) continue;

    // Build the national-significant prefix for this block:
    // area code digits (strip non-digits, drop any leading 0) + block digits.
    const code  = String(cells[codeIdx]  || '').replace(/\D/g, '').replace(/^0/, '');
    const block = blockIdx !== -1 ? String(cells[blockIdx] || '').replace(/\D/g, '') : '';
    const prefix = code + block;
    if (prefix.length < 4) continue; // too short to be useful

    allocatedRows++;
    if (!prefixesByLen.has(prefix.length)) prefixesByLen.set(prefix.length, new Set());
    prefixesByLen.get(prefix.length).add(prefix);
  }
  console.log(`  ✓ ${file}`);
}

// ── emit compact JSON ─────────────────────────────────────────────────────
const out = { generated: new Date().toISOString(), lengths: [], prefixes: {} };
for (const [len, set] of [...prefixesByLen.entries()].sort((a, b) => a[0] - b[0])) {
  out.lengths.push(len);
  out.prefixes[len] = [...set].sort();
}

writeFileSync(outputFile, JSON.stringify(out));
const sizeMB = (statSync(outputFile).size / 1048576).toFixed(2);

console.log('\n─────────────────────────────────────────────');
console.log(`Files processed : ${files}`);
console.log(`Rows scanned    : ${totalRows.toLocaleString()}`);
console.log(`Allocated blocks: ${allocatedRows.toLocaleString()}`);
console.log(`Prefix lengths  : ${out.lengths.join(', ')}`);
console.log(`Output          : ${outputFile} (${sizeMB} MB)`);
console.log('Done. Commit this file and the app will use it automatically.');
