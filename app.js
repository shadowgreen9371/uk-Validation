/* ═══════════════════════════════════════════════════════════════════════
   UK Phone Validation Workstation
   Folder/Excel ingest → validate → classify line-type → dedup → live-check
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const state = {
  files: [], records: [], tab: 'landline', query: '',
  sortCol: null, sortDir: 'asc', page: 1, pageSize: 100,
};

const PHONE_VARIANTS = ['phone','mobile','cell','telephone','tel','number','phone_number',
  'mobile_number','contact','msisdn','phonenumber','landline','telephonenumber','tel_no','telno'];

const $ = id => document.getElementById(id);

// ── File ingestion ──────────────────────────────────────────────────────
$('folderInput').addEventListener('change', e => addFiles(e.target.files));
$('fileInput').addEventListener('change',   e => addFiles(e.target.files));

const dz = $('dropZone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag-over');
  const items = e.dataTransfer.items, collected = [];
  if (items && items.length && items[0].webkitGetAsEntry) {
    let pending = 0, done = false;
    const finish = () => { if (done && pending === 0) addFiles(collected); };
    const walk = entry => {
      if (entry.isFile) { pending++; entry.file(f => { if (isSupported(f.name)) collected.push(f); pending--; finish(); }); }
      else if (entry.isDirectory) {
        pending++;
        const rd = entry.createReader();
        const readBatch = () => rd.readEntries(ents => {
          if (ents.length) { ents.forEach(walk); readBatch(); } else { pending--; finish(); }
        });
        readBatch();
      }
    };
    for (const it of items) { const en = it.webkitGetAsEntry(); if (en) walk(en); }
    done = true; finish();
  } else {
    addFiles(e.dataTransfer.files);
  }
});

function isSupported(name){ return /\.(csv|xls|xlsx|txt)$/i.test(name); }

function addFiles(files){
  const incoming = Array.from(files).filter(f => isSupported(f.name));
  state.files.push(...incoming);
  renderFileList();
  $('btnProcess').disabled = state.files.length === 0;
}

function renderFileList(){
  const p = $('fileListPanel');
  p.style.display = state.files.length ? '' : 'none';
  $('fileCount').textContent = state.files.length;
  $('fileList').innerHTML = state.files.map((f,i)=>`
    <li class="file-item"><span class="fi-name" title="${f.name}">${f.name}</span>
    <span class="fi-size">${fmtSize(f.size)}</span>
    <span class="fi-status" id="fi-${i}"></span></li>`).join('');
}
function fmtSize(b){ return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'; }

// ── Process ──────────────────────────────────────────────────────────────
$('btnProcess').addEventListener('click', processAll);

async function processAll(){
  if(!state.files.length) return;
  $('btnProcess').disabled = true;
  state.records = [];
  $('statsBar').style.display = '';
  $('progressWrap').style.display = '';

  const defCountry = $('defaultCountry').value;
  const colHint = $('phoneCol').value.trim().toLowerCase();

  for(let i=0;i<state.files.length;i++){
    const f = state.files[i];
    showProgress(Math.round(i/state.files.length*55), `Reading ${f.name}…`);
    try{
      const rows = await parseFile(f);
      const el = $(`fi-${i}`); if(el) el.className='fi-status done';
      rows.forEach(r => r._file = f.name);
      state.records.push(...rows);
    }catch(err){
      const el = $(`fi-${i}`); if(el) el.className='fi-status error';
      console.warn('parse fail', f.name, err);
    }
  }

  showProgress(65,'Detecting phone column…'); await tick();
  const phoneCol = detectCol(state.records, colHint);

  showProgress(72,'Validating & classifying UK numbers…'); await tick();
  classify(state.records, phoneCol, defCountry);

  if($('ukOnly').checked)
    state.records = state.records.filter(r => r._country === 'GB' || r._status === 'invalid');

  showProgress(88,'Removing duplicates…'); await tick();
  if($('dedup').checked) dedup(state.records);

  showProgress(100,'Done'); await tick();

  updateStats();
  $('tabBar').style.display=''; $('tableToolbar').style.display='';
  $('progressWrap').style.display='none';
  $('btnExportLandline').disabled=false; $('btnExportAll').disabled=false;
  $('btnLiveCheck').disabled = false;
  state.tab='landline'; setActiveTab('landline');
  renderTable();
}

function showProgress(p,l){ $('progressFill').style.width=p+'%'; $('progressLabel').textContent=l; }
const tick = () => new Promise(r=>setTimeout(r,0));

// ── Parsers ──────────────────────────────────────────────────────────────
function parseFile(f){
  const ext = f.name.split('.').pop().toLowerCase();
  if(ext==='csv'||ext==='txt') return parseCsv(f);
  return parseExcel(f);
}
function parseCsv(f){
  return new Promise((res,rej)=>Papa.parse(f,{header:true,skipEmptyLines:true,
    complete:r=>res(r.data),error:rej}));
}
function parseExcel(f){
  return new Promise((res,rej)=>{
    const rd=new FileReader();
    rd.onload=e=>{try{
      const wb=XLSX.read(e.target.result,{type:'array'});const rows=[];
      wb.SheetNames.forEach(n=>rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:''})));
      res(rows);
    }catch(err){rej(err);}};
    rd.onerror=rej; rd.readAsArrayBuffer(f);
  });
}

// ── Column detection ─────────────────────────────────────────────────────
function detectCol(records, hint){
  if(!records.length) return null;
  const keys = Object.keys(records[0]);
  const norm = s => s.toLowerCase().replace(/[^a-z]/g,'');
  if(hint){
    const e=keys.find(k=>k.toLowerCase()===hint); if(e) return e;
    const p=keys.find(k=>k.toLowerCase().includes(hint)); if(p) return p;
  }
  for(const v of PHONE_VARIANTS){ const m=keys.find(k=>norm(k)===norm(v)); if(m) return m; }
  for(const v of PHONE_VARIANTS){ const m=keys.find(k=>norm(k).includes(norm(v))); if(m) return m; }
  // fallback: column whose values look most like phone numbers
  let best=null,score=-1;
  keys.forEach(k=>{
    const s=records.slice(0,50).filter(r=>/[\d]{6,}/.test(String(r[k]||''))).length;
    if(s>score){score=s;best=k;}
  });
  return best;
}

// ── Validate + UK line-type classification ───────────────────────────────
function classify(records, phoneCol, defCountry){
  records.forEach(r=>{
    const raw = phoneCol ? String(r[phoneCol]??'').trim() : '';
    r._raw = raw;
    if(!raw){ r._status='invalid'; r._line='—'; r._reason='Missing'; r._e164=''; r._country=''; return; }

    let p=null;
    try{ p=libphonenumber.parsePhoneNumber(raw, defCountry); }
    catch(_){ try{ p=libphonenumber.parsePhoneNumber(raw); }catch(__){} }

    if(!p || !p.isValid()){
      r._status='invalid'; r._line='—';
      r._reason = p ? 'Wrong length/area code' : 'Unparseable';
      r._e164 = raw; r._country='';
      return;
    }

    r._e164 = p.format('E.164');
    r._country = p.country || defCountry;
    r._national = p.formatNational();
    const type = p.getType(); // FIXED_LINE, MOBILE, FIXED_LINE_OR_MOBILE, VOIP, PREMIUM_RATE, TOLL_FREE, ...

    if(type==='FIXED_LINE'){ r._status='landline'; r._line='Landline'; }
    else if(type==='MOBILE'){ r._status='mobile'; r._line='Mobile'; }
    else if(type==='FIXED_LINE_OR_MOBILE'){ r._status='landline'; r._line='Fixed/Mobile'; }
    else if(type==='VOIP'){ r._status='other'; r._line='VoIP'; }
    else if(type==='PREMIUM_RATE'){ r._status='other'; r._line='Premium'; }
    else if(type==='TOLL_FREE'){ r._status='other'; r._line='Toll-free'; }
    else { r._status='other'; r._line=type||'Other'; }

    r._reason=''; r._live='';   // live status filled by API later
  });
}

// ── Deduplicate by E.164 ────────────────────────────────────────────────
function dedup(records){
  const seen=new Set();
  records.forEach(r=>{
    if(r._status==='invalid'||!r._e164) return;
    if(seen.has(r._e164)){ r._status='duplicate'; r._reason='Duplicate'; }
    else seen.add(r._e164);
  });
}

// ── Stats ────────────────────────────────────────────────────────────────
function updateStats(){
  const c = s => state.records.filter(r=>r._status===s).length;
  $('sTotal').textContent = state.records.length.toLocaleString();
  $('sLand').textContent  = c('landline').toLocaleString();
  $('sMob').textContent   = c('mobile').toLocaleString();
  $('sOther').textContent = c('other').toLocaleString();
  $('sBad').textContent   = c('invalid').toLocaleString();
  $('sDup').textContent   = c('duplicate').toLocaleString();
}

// ── Filter + render ──────────────────────────────────────────────────────
function filtered(){
  let rows = state.records;
  if(state.tab!=='all') rows = rows.filter(r=>r._status===state.tab);
  if(state.query){
    const q=state.query.toLowerCase();
    rows = rows.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(q)));
  }
  if(state.sortCol){
    rows=[...rows].sort((a,b)=>{
      const av=String(a[state.sortCol]??'').toLowerCase(), bv=String(b[state.sortCol]??'').toLowerCase();
      return state.sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
    });
  }
  return rows;
}

function renderTable(){
  const rows=filtered();
  const totalPages=Math.max(1,Math.ceil(rows.length/state.pageSize));
  state.page=Math.min(state.page,totalPages);
  const pageRows=rows.slice((state.page-1)*state.pageSize, state.page*state.pageSize);

  if(!rows.length){ $('emptyState').style.display=''; $('dataTable').style.display='none'; $('pagination').style.display='none'; return; }
  $('emptyState').style.display='none'; $('dataTable').style.display='';

  const dataKeys = state.records.length ? Object.keys(state.records[0]).filter(k=>!k.startsWith('_')) : [];
  const cols = [...dataKeys, '_line', '_e164', '_live', '_status'];

  $('tableHead').innerHTML = `<tr>${cols.map(c=>{
    const label = c.startsWith('_') ? ({_line:'Line Type',_e164:'E.164',_live:'Live Check',_status:'Status'}[c]||c.slice(1)) : c;
    return `<th data-col="${c}">${label}</th>`;
  }).join('')}</tr>`;

  $('tableBody').innerHTML = pageRows.map(r=>`<tr>${cols.map(c=>{
    if(c==='_status'){const m={landline:'b-landline ☎️ Landline',mobile:'b-mobile 📱 Mobile',other:'b-other 🔵 '+r._line,invalid:'b-invalid ❌ Invalid',duplicate:'b-duplicate 🔁 Dup'};
      const raw=m[r._status]||'b-other '+r._status;const cls=raw.split(' ')[0];const lbl=raw.split(' ').slice(1).join(' ');
      return `<td><span class="badge-status ${cls}">${lbl}</span></td>`;}
    if(c==='_e164') return `<td><code>${r._e164||''}</code></td>`;
    if(c==='_live'){
      if(!r._live) return `<td><span class="badge-status b-live-unknown">—</span></td>`;
      const lc = r._live==='active'?'b-live-active ✅ Active':r._live==='dead'?'b-live-dead ❌ Dead':'b-live-unknown '+r._live;
      const cls=lc.split(' ')[0];const lbl=lc.split(' ').slice(1).join(' ');
      return `<td><span class="badge-status ${cls}">${lbl}</span></td>`;
    }
    if(c==='_line') return `<td>${r._line||''}</td>`;
    const v=r[c]??''; return `<td title="${String(v).replace(/"/g,'&quot;')}">${String(v)}</td>`;
  }).join('')}</tr>`).join('');

  $('pagination').style.display='';
  $('pgInfo').textContent=`Page ${state.page} of ${totalPages} (${rows.length.toLocaleString()} rows)`;
  $('pgPrev').disabled=state.page<=1; $('pgNext').disabled=state.page>=totalPages;

  $('tableHead').querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{
    const c=th.dataset.col;
    if(state.sortCol===c) state.sortDir=state.sortDir==='asc'?'desc':'asc';
    else{state.sortCol=c;state.sortDir='asc';}
    state.page=1; renderTable();
  }));
}

// ── Tabs / search / paging ──────────────────────────────────────────────
function setActiveTab(t){ document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===t)); }
$('tabBar').addEventListener('click',e=>{
  const t=e.target.closest('.tab'); if(!t) return;
  state.tab=t.dataset.tab; state.page=1; setActiveTab(state.tab); renderTable();
});
let st; $('searchInput').addEventListener('input',e=>{clearTimeout(st);st=setTimeout(()=>{state.query=e.target.value.trim();state.page=1;renderTable();},200);});
$('pgPrev').addEventListener('click',()=>{state.page--;renderTable();});
$('pgNext').addEventListener('click',()=>{state.page++;renderTable();});

// ── Live check (Veriphone free API) ──────────────────────────────────────
$('btnLiveCheck').addEventListener('click', liveCheck);

async function liveCheck(){
  const key = $('apiKey').value.trim();
  if(!key){ alert('Paste a free Veriphone API key first (veriphone.io → free 1,000/month).'); return; }
  const targets = state.records.filter(r=>r._status==='landline' && !r._live);
  if(!targets.length){ alert('No un-checked landlines to verify.'); return; }
  if(targets.length>1000 && !confirm(`${targets.length} landlines — free tier is ~1,000/month. Continue and check the first 1,000?`)) return;

  const lp = $('liveProgress');
  $('btnLiveCheck').disabled = true;
  const batch = targets.slice(0,1000);
  for(let i=0;i<batch.length;i++){
    const r=batch[i];
    lp.textContent = `Checking ${i+1}/${batch.length}…`;
    try{
      const url=`https://api.veriphone.io/v2/verify?phone=${encodeURIComponent(r._e164)}&key=${encodeURIComponent(key)}`;
      const res=await fetch(url);
      const d=await res.json();
      // Veriphone returns phone_valid + carrier; we map to active/dead/unknown
      if(d.status==='success' && d.phone_valid){
        r._live = d.carrier ? 'active' : 'unknown';
        if(d.carrier) r._carrier = d.carrier;
      } else if(d.status==='success' && !d.phone_valid){
        r._live='dead';
      } else { r._live='unknown'; }
    }catch(_){ r._live='unknown'; }
    if(i%10===0) renderTable();
  }
  lp.textContent = `Done — ${batch.length} checked.`;
  $('btnLiveCheck').disabled=false;
  renderTable();
}

// ── Export ───────────────────────────────────────────────────────────────
$('btnExportLandline').addEventListener('click',()=>exportRows(r=>r._status==='landline','uk_landlines.csv'));
$('btnExportAll').addEventListener('click',()=>exportRows(()=>true,'all_processed.csv'));

function exportRows(pred, filename){
  const rows=state.records.filter(pred);
  if(!rows.length) return alert('Nothing to export in this set.');
  const dataKeys=Object.keys(rows[0]).filter(k=>!k.startsWith('_'));
  const out=rows.map(r=>{
    const o={}; dataKeys.forEach(k=>o[k]=r[k]??'');
    o.e164=r._e164; o.line_type=r._line; o.status=r._status;
    o.live_check=r._live||''; o.carrier=r._carrier||'';
    return o;
  });
  const csv=Papa.unparse(out);
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  URL.revokeObjectURL(a.href);
}

// ── Reset ────────────────────────────────────────────────────────────────
$('btnReset').addEventListener('click',()=>{
  Object.assign(state,{files:[],records:[],tab:'landline',query:'',sortCol:null,page:1});
  $('folderInput').value=''; $('fileInput').value=''; $('fileList').innerHTML='';
  ['fileListPanel','statsBar','tabBar','tableToolbar','pagination','progressWrap'].forEach(id=>$(id).style.display='none');
  $('dataTable').style.display='none'; $('emptyState').style.display='';
  $('btnProcess').disabled=true; $('btnExportLandline').disabled=true; $('btnExportAll').disabled=true; $('btnLiveCheck').disabled=true;
  $('searchInput').value=''; $('liveProgress').textContent='';
});
