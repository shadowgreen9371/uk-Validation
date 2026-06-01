// ─── State ────────────────────────────────────────────────────────────────────
const state = { valid: [], invalid: [], dupes: [] };

// ─── Country dial codes (E.164 prefixes) ─────────────────────────────────────
const DIAL = { US: '1', GB: '44', AU: '61', CA: '1', IN: '91' };

// ─── Parse ────────────────────────────────────────────────────────────────────
function parseInput(raw) {
  return raw
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ─── Strip to digits only ─────────────────────────────────────────────────────
function digitsOnly(s) {
  return s.replace(/\D/g, '');
}

// ─── Validate & normalise ─────────────────────────────────────────────────────
function normalise(raw, defaultCountry, toE164) {
  const stripped = raw.replace(/\s+/g, '');
  let digits = digitsOnly(stripped);

  // Already has country code prefix (+XX or 00XX)?
  let hasCountry = stripped.startsWith('+') || stripped.startsWith('00');

  if (!hasCountry) {
    // US/CA 10-digit → prepend country code
    if ((defaultCountry === 'US' || defaultCountry === 'CA') && digits.length === 10) {
      digits = DIAL[defaultCountry] + digits;
      hasCountry = true;
    } else if (defaultCountry === 'GB' && (digits.length === 10 || digits.length === 11)) {
      digits = digits.startsWith('0') ? '44' + digits.slice(1) : '44' + digits;
      hasCountry = true;
    } else if (defaultCountry === 'AU' && (digits.length === 9 || digits.length === 10)) {
      digits = digits.startsWith('0') ? '61' + digits.slice(1) : '61' + digits;
      hasCountry = true;
    } else if (defaultCountry === 'IN' && (digits.length === 10 || digits.length === 12)) {
      digits = digits.length === 10 ? '91' + digits : digits;
      hasCountry = true;
    }
  } else {
    // Strip leading + or 00
    digits = stripped.startsWith('00') ? digits.slice(2) : digits;
  }

  // Basic length check: E.164 is 7–15 digits total (including country code)
  if (digits.length < 7 || digits.length > 15) return null;

  return toE164 ? '+' + digits : raw;
}

function isValid(raw, defaultCountry, toE164) {
  return normalise(raw, defaultCountry, toE164) !== null;
}

// ─── Process ──────────────────────────────────────────────────────────────────
function process() {
  const raw = document.getElementById('phoneInput').value;
  const toE164 = document.getElementById('intlFormat').checked;
  const removeDupes = document.getElementById('removeDupes').checked;
  const defaultCountry = document.getElementById('defaultCountry').value;

  const lines = parseInput(raw);

  state.valid = [];
  state.invalid = [];
  state.dupes = [];

  const seen = new Set();

  for (const line of lines) {
    const normalised = normalise(line, defaultCountry, toE164);

    if (normalised === null) {
      state.invalid.push(line);
      continue;
    }

    const key = digitsOnly(normalised);

    if (removeDupes && seen.has(key)) {
      state.dupes.push(line);
    } else {
      seen.add(key);
      state.valid.push(normalised);
    }
  }

  renderResults();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderResults() {
  document.getElementById('resultsSection').hidden = false;

  // Stats
  const total = state.valid.length + state.invalid.length + state.dupes.length;
  document.getElementById('statsRow').innerHTML = `
    <div class="stat total"><div class="num">${total}</div><div class="lbl">Total input</div></div>
    <div class="stat valid"><div class="num">${state.valid.length}</div><div class="lbl">Valid</div></div>
    <div class="stat invalid"><div class="num">${state.invalid.length}</div><div class="lbl">Invalid</div></div>
    <div class="stat dupe"><div class="num">${state.dupes.length}</div><div class="lbl">Duplicates</div></div>
  `;

  document.getElementById('validOutput').value = state.valid.join('\n');
  document.getElementById('invalidOutput').value = state.invalid.join('\n');
  document.getElementById('dupesOutput').value = state.dupes.join('\n');
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('tab' + capitalise(btn.dataset.tab)).classList.remove('hidden');
  });
});

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Export helpers ───────────────────────────────────────────────────────────
function copyOutput(id) {
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.value).then(() => {
    showToast('Copied!');
  });
}

function exportCSV(type) {
  const rows = state[type].map(n => `"${n}"`).join('\n');
  download(`phones_${type}.csv`, 'text/csv', 'phone\n' + rows);
}

function exportTXT(type) {
  download(`phones_${type}.txt`, 'text/plain', state[type].join('\n'));
}

function download(filename, mime, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    background: '#4f8ef7', color: '#fff', padding: '10px 18px',
    borderRadius: '8px', fontWeight: '600', zIndex: 9999,
    animation: 'fadeIn 0.2s ease'
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

// ─── Wire up button ───────────────────────────────────────────────────────────
document.getElementById('processBtn').addEventListener('click', process);
