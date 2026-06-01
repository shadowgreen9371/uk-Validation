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

// ── UK area code → town/region (built-in, free, no download) ──────────────
// Keyed by national-prefix digits (no leading 0). Matched longest-first.
const UK_AREAS = {
  '20':'London','23':'Southampton/Portsmouth','24':'Coventry','28':'Northern Ireland','29':'Cardiff',
  '113':'Leeds','114':'Sheffield','115':'Nottingham','116':'Leicester','117':'Bristol','118':'Reading',
  '121':'Birmingham','131':'Edinburgh','141':'Glasgow','151':'Liverpool','161':'Manchester','191':'Tyne & Wear',
  '1204':'Bolton','1206':'Colchester','1224':'Aberdeen','1223':'Cambridge','1225':'Bath','1226':'Barnsley',
  '1227':'Canterbury','1233':'Ashford','1234':'Bedford','1235':'Abingdon','1236':'Coatbridge','1241':'Arbroath',
  '1242':'Cheltenham','1243':'Chichester','1244':'Chester','1245':'Chelmsford','1246':'Chesterfield','1248':'Bangor',
  '1249':'Chippenham','1252':'Aldershot','1253':'Blackpool','1254':'Blackburn','1255':'Clacton','1256':'Basingstoke',
  '1257':'Coppull','1258':'Blandford','1259':'Alloa','1260':'Congleton','1261':'Banff','1262':'Bridlington',
  '1263':'Cromer','1264':'Andover','1267':'Carmarthen','1268':'Basildon','1269':'Ammanford','1270':'Crewe',
  '1271':'Barnstaple','1273':'Brighton','1274':'Bradford','1275':'Clevedon','1276':'Camberley','1277':'Brentwood',
  '1278':'Bridgwater','1279':'Bishops Stortford','1280':'Buckingham','1283':'Burton-on-Trent','1284':'Bury St Edmunds',
  '1286':'Caernarfon','1287':'Guisborough','1288':'Bude','1289':'Berwick','1290':'Cumnock','1291':'Chepstow',
  '1292':'Ayr','1293':'Crawley','1294':'Ardrossan','1295':'Banbury','1296':'Aylesbury','1297':'Axminster',
  '1298':'Buxton','1299':'Bewdley','1302':'Doncaster','1303':'Folkestone','1304':'Dover','1305':'Dorchester',
  '1306':'Dorking','1307':'Forfar','1308':'Bridport','1309':'Forres','1322':'Dartford','1323':'Eastbourne',
  '1324':'Falkirk','1325':'Darlington','1326':'Falmouth','1327':'Daventry','1328':'Fakenham','1329':'Fareham',
  '1330':'Banchory','1332':'Derby','1333':'Peat Inn','1334':'St Andrews','1335':'Ashbourne','1337':'Cupar',
  '1339':'Aboyne','1340':'Craigellachie','1341':'Barmouth','1342':'East Grinstead','1343':'Elgin','1344':'Bracknell',
  '1346':'Fraserburgh','1347':'Easingwold','1348':'Fishguard','1349':'Dingwall','1350':'Dunkeld','1352':'Mold',
  '1353':'Ely','1354':'Chatteris','1355':'East Kilbride','1356':'Brechin','1357':'Strathaven','1358':'Ellon',
  '1359':'Pakenham','1360':'Killearn','1361':'Duns','1362':'Dereham','1363':'Crediton','1364':'Ashburton',
  '1366':'Downham Market','1367':'Faringdon','1368':'Dunbar','1369':'Dunoon','1371':'Great Dunmow','1372':'Esher',
  '1373':'Frome','1375':'Grays Thurrock','1376':'Braintree','1377':'Driffield','1379':'Diss','1380':'Devizes',
  '1381':'Fortrose','1382':'Dundee','1386':'Evesham','1387':'Dumfries','1388':'Bishop Auckland','1389':'Dumbarton',
  '1392':'Exeter','1394':'Felixstowe','1395':'Budleigh Salterton','1397':'Fort William','1398':'Dulverton',
  '1404':'Honiton','1405':'Goole','1406':'Holbeach','1407':'Holyhead','1408':'Golspie','1409':'Holsworthy',
  '1420':'Alton','1422':'Halifax','1423':'Harrogate','1424':'Hastings','1425':'Ringwood','1426':'Hayle',
  '1427':'Gainsborough','1428':'Haslemere','1429':'Hartlepool','1430':'Howden','1431':'Helmsdale','1432':'Hereford',
  '1433':'Hathersage','1434':'Hexham','1435':'Heathfield','1436':'Helensburgh','1437':'Haverfordwest','1438':'Stevenage',
  '1439':'Helmsley','1440':'Haverhill','1442':'Hemel Hempstead','1443':'Pontypridd','1444':'Haywards Heath',
  '1445':'Gairloch','1446':'Barry','1449':'Stowmarket','1450':'Hawick','1451':'Stow-on-the-Wold','1452':'Gloucester',
  '1453':'Dursley','1454':'Chipping Sodbury','1455':'Hinckley','1456':'Glenurquhart','1457':'Glossop','1458':'Glastonbury',
  '1460':'Chard','1461':'Gretna','1462':'Hitchin','1463':'Inverness','1464':'Insch','1465':'Girvan','1466':'Huntly',
  '1467':'Inverurie','1469':'Killingholme','1470':'Isle of Skye','1471':'Broadford','1472':'Grimsby','1473':'Ipswich',
  '1474':'Gravesend','1475':'Greenock','1476':'Grantham','1477':'Holmes Chapel','1478':'Portree','1479':'Aviemore',
  '1480':'Huntingdon','1481':'Guernsey','1482':'Hull','1483':'Guildford','1485':'Hunstanton','1487':'Warboys',
  '1488':'Hungerford','1489':'Bishops Waltham','1490':'Corwen','1491':'Henley-on-Thames','1492':'Colwyn Bay',
  '1493':'Great Yarmouth','1494':'High Wycombe','1495':'Pontypool','1496':'Port Ellen','1497':'Hay-on-Wye',
  '1499':'Inveraray','1501':'Harthill','1502':'Lowestoft','1503':'Looe','1505':'Johnstone','1506':'Bathgate',
  '1507':'Louth','1508':'Brooke','1509':'Loughborough','1510':'Llanelli','1520':'Lochcarron','1522':'Lincoln',
  '1524':'Lancaster','1525':'Leighton Buzzard','1526':'Martin','1527':'Redditch','1528':'Laggan','1529':'Sleaford',
  '1530':'Coalville','1531':'Ledbury','1534':'Jersey','1535':'Keighley','1536':'Kettering','1538':'Ipstones',
  '1539':'Kendal','1540':'Kingussie','1542':'Keith','1543':'Cannock','1544':'Kington','1545':'Llanarth',
  '1546':'Lochgilphead','1547':'Knighton','1548':'Kingsbridge','1549':'Lairg','1550':'Llandovery','1553':'Kings Lynn',
  '1554':'Llanelli','1555':'Lanark','1556':'Castle Douglas','1557':'Kirkcudbright','1558':'Llandeilo','1559':'Llandysul',
  '1560':'Moscow','1561':'Laurencekirk','1562':'Kidderminster','1563':'Kilmarnock','1564':'Lapworth','1565':'Knutsford',
  '1566':'Launceston','1567':'Killin','1568':'Leominster','1569':'Stonehaven','1570':'Lampeter','1571':'Lochinver',
  '1572':'Oakham','1573':'Kelso','1575':'Kirriemuir','1576':'Lockerbie','1577':'Kinross','1578':'Lauder',
  '1579':'Liskeard','1580':'Cranbrook','1581':'New Luce','1582':'Luton','1583':'Carradale','1584':'Ludlow',
  '1586':'Campbeltown','1588':'Bishops Castle','1590':'Lymington','1591':'Llanwrtyd Wells','1592':'Kirkcaldy',
  '1593':'Lybster','1594':'Lydney','1595':'Lerwick','1597':'Llandrindod Wells','1598':'Lynton','1599':'Kyle',
  '1600':'Monmouth','1603':'Norwich','1604':'Northampton','1606':'Northwich','1608':'Chipping Norton','1609':'Northallerton',
  '1620':'North Berwick','1621':'Maldon','1622':'Maidstone','1623':'Mansfield','1624':'Isle of Man','1625':'Macclesfield',
  '1626':'Newton Abbot','1628':'Maidenhead','1629':'Matlock','1630':'Market Drayton','1631':'Oban','1633':'Newport',
  '1634':'Medway','1635':'Newbury','1636':'Newark','1637':'Newquay','1638':'Newmarket','1639':'Neath','1641':'Strathy',
  '1642':'Middlesbrough','1643':'Minehead','1644':'New Galloway','1646':'Milford Haven','1647':'Moretonhampstead',
  '1650':'Cemmaes Road','1651':'Oldmeldrum','1652':'Brigg','1653':'Malton','1654':'Machynlleth','1655':'Maybole',
  '1656':'Bridgend','1659':'Sanquhar','1661':'Prudhoe','1663':'New Mills','1664':'Melton Mowbray','1665':'Alnwick',
  '1666':'Malmesbury','1667':'Nairn','1668':'Bamburgh','1669':'Rothbury','1670':'Morpeth','1671':'Newton Stewart',
  '1672':'Marlborough','1673':'Market Rasen','1674':'Montrose','1675':'Coleshill','1676':'Meriden','1677':'Bedale',
  '1678':'Bala','1680':'Isle of Mull','1681':'Isle of Mull','1683':'Moffat','1684':'Malvern','1685':'Merthyr Tydfil',
  '1686':'Newtown','1687':'Mallaig','1688':'Isle of Mull','1689':'Orpington','1690':'Betws-y-Coed','1691':'Oswestry',
  '1692':'North Walsham','1694':'Church Stretton','1695':'Skelmersdale','1697':'Brampton','1698':'Motherwell','1700':'Rothesay',
  '1702':'Southend-on-Sea','1704':'Southport','1706':'Rochdale','1707':'Welwyn','1708':'Romford','1709':'Rotherham',
  '1720':'Isles of Scilly','1721':'Peebles','1722':'Salisbury','1723':'Scarborough','1724':'Scunthorpe','1725':'Rockbourne',
  '1726':'St Austell','1727':'St Albans','1728':'Saxmundham','1729':'Settle','1730':'Petersfield','1732':'Sevenoaks',
  '1733':'Peterborough','1736':'Penzance','1737':'Redhill','1738':'Perth','1740':'Sedgefield','1743':'Shrewsbury',
  '1744':'St Helens','1745':'Rhyl','1746':'Bridgnorth','1747':'Shaftesbury','1748':'Richmond','1749':'Shepton Mallet',
  '1750':'Selkirk','1751':'Pickering','1752':'Plymouth','1753':'Slough','1754':'Skegness','1756':'Skipton',
  '1757':'Selby','1758':'Pwllheli','1759':'Pocklington','1760':'Swaffham','1761':'Temple Cloud','1763':'Royston',
  '1764':'Crieff','1765':'Ripon','1766':'Porthmadog','1767':'Sandy','1768':'Penrith','1769':'South Molton',
  '1770':'Isle of Arran','1772':'Preston','1773':'Ripley','1775':'Spalding','1776':'Stranraer','1777':'Retford',
  '1778':'Bourne','1779':'Peterhead','1780':'Stamford','1782':'Stoke-on-Trent','1784':'Staines','1785':'Stafford',
  '1786':'Stirling','1787':'Sudbury','1788':'Rugby','1789':'Stratford-upon-Avon','1790':'Spilsby','1792':'Swansea',
  '1793':'Swindon','1794':'Romsey','1795':'Sittingbourne','1796':'Pitlochry','1797':'Rye','1798':'Pulborough',
  '1799':'Saffron Walden','1803':'Torquay','1804':'York','1805':'Torrington','1806':'Shetland','1807':'Ballindalloch',
  '1808':'Tomatin','1809':'Invergarry','1822':'Tavistock','1823':'Taunton','1824':'Ruthin','1825':'Uckfield',
  '1827':'Tamworth','1828':'Coupar Angus','1829':'Tarporley','1830':'Kirkwhelpington','1832':'Clopton','1833':'Barnard Castle',
  '1834':'Narberth','1835':'St Boswells','1837':'Okehampton','1838':'Dalmally','1840':'Camelford','1841':'Padstow',
  '1842':'Thetford','1843':'Thanet','1844':'Thame','1845':'Thirsk','1847':'Thurso','1848':'Thornhill','1851':'Stornoway',
  '1852':'Kilmelford','1854':'Ullapool','1856':'Orkney','1857':'Sanday','1858':'Market Harborough','1859':'Harris',
  '1862':'Tain','1863':'Ardgay','1864':'Abington','1865':'Oxford','1866':'Kilchrenan','1869':'Bicester','1870':'Isle of Benbecula',
  '1871':'Castlebay','1872':'Truro','1873':'Abergavenny','1874':'Brecon','1875':'Tranent','1876':'Lochmaddy',
  '1877':'Callander','1878':'Lochboisdale','1879':'Scarinish','1880':'Tarbert','1882':'Kinloch Rannoch','1883':'Caterham',
  '1884':'Tiverton','1885':'Pencombe','1886':'Bromyard','1887':'Aberfeldy','1888':'Turriff','1889':'Rugeley',
  '1890':'Ayton','1891':'Coldstream','1892':'Tunbridge Wells','1895':'Uxbridge','1896':'Galashiels','1899':'Biggar',
  '1900':'Workington','1902':'Wolverhampton','1903':'Worthing','1904':'York','1905':'Worcester','1908':'Milton Keynes',
  '1909':'Worksop','1910':'Tyneside','1912':'Tyneside','1913':'Durham','1914':'Tyneside','1915':'Sunderland',
  '1916':'Tyneside','1917':'Sunderland','1918':'Tyneside','1919':'Durham','1920':'Ware','1922':'Walsall','1923':'Watford',
  '1924':'Wakefield','1925':'Warrington','1926':'Warwick','1928':'Runcorn','1929':'Wareham','1931':'Shap','1932':'Weybridge',
  '1933':'Wellingborough','1934':'Weston-super-Mare','1935':'Yeovil','1937':'Wetherby','1938':'Welshpool','1939':'Wem',
  '1942':'Wigan','1943':'Guiseley','1944':'West Heslerton','1945':'Wisbech','1946':'Whitehaven','1947':'Whitby',
  '1948':'Whitchurch','1949':'Whatton','1950':'Sandwick','1951':'Isle of Colonsay','1952':'Telford','1953':'Wymondham',
  '1954':'Madingley','1955':'Wick','1957':'Mid Yell','1959':'Westerham','1962':'Winchester','1963':'Wincanton',
  '1964':'Hornsea','1967':'Strontian','1968':'Penicuik','1969':'Leyburn','1970':'Aberystwyth','1971':'Scourie',
  '1972':'Glenborrodale','1974':'Llanon','1975':'Alford','1977':'Pontefract','1978':'Wrexham','1980':'Amesbury',
  '1981':'Wormbridge','1982':'Builth Wells','1983':'Isle of Wight','1984':'Watchet','1985':'Warminster','1986':'Bungay',
  '1987':'Ebbsfleet','1988':'Wigtown','1989':'Ross-on-Wye','1992':'Lea Valley','1993':'Witney','1994':'St Clears',
  '1995':'Garstang','1997':'Strathpeffer','1224':'Aberdeen',
};
const UK_AREA_LENS = [5,4,3,2];
function ukArea(parsed){
  if(!parsed || parsed.country!=='GB') return '';
  const nsn = parsed.nationalNumber || '';
  for(const L of UK_AREA_LENS){
    const code = nsn.slice(0,L);
    if(UK_AREAS[code]) return UK_AREAS[code];
  }
  return '';
}

// ── Ofcom data (optional, loaded if ofcom-blocks.json present) ────────────
// Unified file powers BOTH allocation check and allocated-carrier lookup.
//   { lengths:[desc], carriers:[names], map:{ "<prefix>": carrierIndex } }
let ofcom = null;
(async function loadOfcom(){
  try{
    const res = await fetch('ofcom-blocks.json', { cache: 'force-cache' });
    if(!res.ok) return;
    const raw = await res.json();
    if(!raw.map || !raw.lengths) return;
    ofcom = {
      lengths: raw.lengths.slice().sort((a,b)=>b-a),
      carriers: raw.carriers || [],
      map: raw.map,
    };
    const el = $('ofcomStatus');
    if(el) el.textContent = `Ofcom data loaded · ${Object.keys(raw.map).length.toLocaleString()} blocks · ${(raw.carriers||[]).length.toLocaleString()} carriers · ${(raw.generated||'').slice(0,10)}`;
  }catch(_){ /* no data file — allocation/carrier stay "unknown" */ }
})();

// Returns { alloc:'allocated'|'unallocated'|'unknown', carrier:'' }
function ofcomLookup(parsed){
  if(!ofcom || !parsed) return { alloc:'unknown', carrier:'' };
  const nsn = parsed.nationalNumber || String(parsed.number||'').replace(/\D/g,'').replace(/^44/,'');
  if(!nsn) return { alloc:'unknown', carrier:'' };
  for(const L of ofcom.lengths){
    if(nsn.length < L) continue;
    const idx = ofcom.map[nsn.slice(0, L)];
    if(idx !== undefined) return { alloc:'allocated', carrier: ofcom.carriers[idx] || '' };
  }
  return { alloc:'unallocated', carrier:'' };
}

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
    r._area = ukArea(p);        // UK town/region (free, built-in)

    // Ofcom block-allocation + allocated-carrier lookup (free) for UK numbers
    if(r._country === 'GB'){
      const look = ofcomLookup(p);
      r._carrier = look.carrier || '';
      // Only treat landlines' unallocated blocks as dead (mobile data may be absent)
      r._alloc = (r._status === 'landline' || r._line === 'Fixed/Mobile') ? look.alloc : 'unknown';
      if(r._alloc === 'unallocated'){ r._status='invalid'; r._line='Unallocated'; r._reason='Block not allocated by Ofcom'; }
    } else { r._alloc='unknown'; r._carrier=''; }
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
  const cols = [...dataKeys, '_line', '_area', '_e164'];
  if(ofcom){ cols.push('_alloc', '_carrier'); }
  cols.push('_live', '_status');

  $('tableHead').innerHTML = `<tr>${cols.map(c=>{
    const label = c.startsWith('_') ? ({_line:'Line Type',_area:'Area',_e164:'E.164',_alloc:'Ofcom Block',_carrier:'Carrier',_live:'Live Check',_status:'Status'}[c]||c.slice(1)) : c;
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
    if(c==='_alloc'){
      const a=r._alloc;
      if(a==='allocated') return `<td><span class="badge-status b-live-active">✅ Allocated</span></td>`;
      if(a==='unallocated') return `<td><span class="badge-status b-live-dead">❌ Unallocated</span></td>`;
      return `<td><span class="badge-status b-live-unknown">—</span></td>`;
    }
    if(c==='_line') return `<td>${r._line||''}</td>`;
    if(c==='_area') return `<td>${r._area||''}</td>`;
    if(c==='_carrier') return `<td title="${(r._carrier||'').replace(/"/g,'&quot;')}">${r._carrier||''}</td>`;
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
    o.e164=r._e164; o.line_type=r._line; o.area=r._area||''; o.status=r._status;
    o.ofcom_block=r._alloc||''; o.live_check=r._live||''; o.carrier=r._carrier||'';
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
