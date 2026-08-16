/* ============================================================
   காய்கறி பில்லிங் v4
   Changes: Login auth, no trucks, download/share image,
            கூலி label, mobile-first UI
   ============================================================ */

/* -------- Auth & API -------- */
let AUTH_TOKEN = localStorage.getItem('vb_token') || '';

async function api(method, url, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch('/api' + url, opts); }
  catch(e) { throw new Error('சர்வருடன் இணைக்க முடியவில்லை.'); }
  if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
  let data; try { data = await res.json(); } catch(e) { data = null; }
  if (!res.ok) throw new Error((data && data.error) || 'ஏதோ தவறு நடந்தது');
  return data;
}

/* -------- Login -------- */
function showLogin() {
  AUTH_TOKEN = '';
  localStorage.removeItem('vb_token');
  document.getElementById('loginScreen').classList.remove('hidden');
}
function hideLogin() {
  document.getElementById('loginScreen').classList.add('hidden');
}

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const pw = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  if (!pw) { errEl.textContent = 'கடவுச்சொல் உள்ளிடவும்.'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    }).then(r => r.json());
    if (data.error) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
    AUTH_TOKEN = data.token;
    localStorage.setItem('vb_token', AUTH_TOKEN);
    document.getElementById('loginPassword').value = '';
    hideLogin();
    await init();
  } catch(e) {
    errEl.textContent = 'உள்நுழைவு தோல்வி. மீண்டும் முயற்சிக்கவும்.';
    errEl.classList.remove('hidden');
  }
}

/* -------- Cached state -------- */
let shop = {}, items = [], customers = [];
let billRowCounter = 0, currentPrintBill = null, currentLedgerCustomer = null;
let selectableBills = [], lastReport = { bills: [] };

/* -------- Utils -------- */
function money(n) { n=Number(n)||0; return '₹'+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function plain(n) { n=Number(n)||0; return n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pad(n) { return n.toString().padStart(2,'0'); }
function todayISO() { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmt(iso) { if(!iso)return''; const[y,m,d]=iso.split('-'); return`${d}/${m}/${y}`; }
function esc(s) { const div=document.createElement('div'); div.textContent=s??''; return div.innerHTML; }
function findItem(id) { return items.find(x=>x.id===Number(id)); }
function findCustomer(id) { return customers.find(x=>x.id===Number(id)); }
function showErr(e) { if(e.message==='unauthorized')return; alert(e.message||String(e)); }
function dlCSV(content,name) {
  const blob=new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function dlJSON(obj,name) {
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ============================================================
   NAVIGATION — Desktop sidebar + Mobile bottom nav
   ============================================================ */
document.querySelectorAll('.nav-btn, .mob-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'more') { toggleMoreDrawer(); return; }
    closeMoreDrawer();
    switchTab(btn.dataset.tab);
  });
});
document.querySelectorAll('.more-item').forEach(btn => {
  btn.addEventListener('click', () => { closeMoreDrawer(); switchTab(btn.dataset.tab); });
});
document.getElementById('drawerBackdrop').addEventListener('click', closeMoreDrawer);

function toggleMoreDrawer() {
  document.getElementById('moreDrawer').classList.toggle('hidden');
  document.getElementById('drawerBackdrop').classList.toggle('hidden');
}
function closeMoreDrawer() {
  document.getElementById('moreDrawer').classList.add('hidden');
  document.getElementById('drawerBackdrop').classList.add('hidden');
}

async function switchTab(tab) {
  document.querySelectorAll('.nav-btn,.mob-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
  if (tab === 'dashboard')  await renderDashboard();
  if (tab === 'newbill')    await renderNewBillTab();
  if (tab === 'payments')   await renderPaymentsTab();
  if (tab === 'items')      await renderItemsTab();
  if (tab === 'customers')  await renderCustomersTab();
  if (tab === 'reports')    await renderReportsTab();
  if (tab === 'settings')   await renderSettingsTab();
}
document.getElementById('dashNewBillBtn').addEventListener('click', () => switchTab('newbill'));

/* ============================================================
   DASHBOARD
   ============================================================ */
async function renderDashboard() {
  if (shop.name) document.getElementById('brandShopName').textContent = shop.name;
  const now = new Date();
  document.getElementById('todayDateDisplay').textContent =
    fmt(todayISO()) + ' • ' + now.toLocaleDateString('ta-IN', { weekday: 'long' });
  let d; try { d = await api('GET','/dashboard'); } catch(e) { showErr(e); return; }
  document.getElementById('statTodaySales').textContent    = money(d.todaySales);
  document.getElementById('statTodayBills').textContent    = `${d.todayCount} பில்கள்`;
  document.getElementById('statMonthSales').textContent    = money(d.monthSales);
  document.getElementById('statMonthBills').textContent    = `${d.monthCount} பில்கள்`;
  document.getElementById('statPending').textContent       = money(d.totalPending);
  document.getElementById('statCustomerCount').textContent = `${d.customerCount} வாடிக்கையாளர்`;
  document.getElementById('statItemCount').textContent     = d.itemCount;
  const tbody = document.querySelector('#recentBillsTable tbody');
  tbody.innerHTML = '';
  document.getElementById('recentBillsEmpty').style.display = d.recentBills.length ? 'none' : 'block';
  [...d.recentBills].reverse().forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${b.billNo}</td><td>${fmt(b.dateISO)}</td><td>${esc(b.customerName)}</td>
      <td>${money(b.grandTotal)}</td>
      <td><button class="btn btn-ghost btn-sm vb" data-id="${b.id}">🖨</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.vb').forEach(btn => btn.addEventListener('click', () => openPrintById(btn.dataset.id)));
}

/* ============================================================
   NEW BILL
   ============================================================ */
async function renderNewBillTab() {
  try { [items, customers] = await Promise.all([api('GET','/items'), api('GET','/customers')]); }
  catch(e) { showErr(e); return; }
  fillCustSelect('billCustomerSelect');
  updatePrevBal();
  if (!document.getElementById('billItemsBody').children.length) addBillRow();
  recalcBill();
}

function fillCustSelect(id) {
  const sel = document.getElementById(id), cur = sel.value;
  sel.innerHTML = '<option value="">-- தேர்வு செய்யவும் --</option>';
  [...customers].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name + (c.phone ? ` (${c.phone})` : '');
    sel.appendChild(o);
  });
  if (customers.some(c => String(c.id) === cur)) sel.value = cur;
}

document.getElementById('billCustomerSelect').addEventListener('change', updatePrevBal);
function updatePrevBal() {
  const cust = findCustomer(document.getElementById('billCustomerSelect').value);
  const prev = cust ? (Number(cust.balance)||0) : 0;
  document.getElementById('prevBalStrong').textContent = money(prev);
  document.getElementById('billPrevBalanceVal').textContent = money(prev);
  recalcBill();
}

document.getElementById('addItemRowBtn').addEventListener('click', addBillRow);

function addBillRow() {
  const body = document.getElementById('billItemsBody');
  const rowId = ++billRowCounter;
  const div = document.createElement('div');
  div.className = 'mbill-row'; div.dataset.rowId = rowId;
  const opts = ['<option value="">-- பொருள் தேர்வு --</option>',
    ...items.map(it => `<option value="${it.id}">${esc(it.name)}</option>`)].join('');
  div.innerHTML = `
    <select class="ri">${opts}</select>
    <div class="mbill-bottom">
      <input type="number" class="rq" min="0" step="0.5" placeholder="அளவு">
      <span class="mbill-x">×</span>
      <input type="number" class="rp" min="0" step="0.5" placeholder="விலை">
      <span class="mbill-val rv">₹0</span>
      <button class="mbill-del">✕</button>
    </div>`;
  body.appendChild(div);

  const sel=div.querySelector('.ri'), qty=div.querySelector('.rq'),
        prc=div.querySelector('.rp'), val=div.querySelector('.rv');
  sel.addEventListener('change', () => {
    const it = findItem(sel.value);
    if (it) { prc.value = it.price; }
    else { prc.value = ''; }
    recalcBillRow(div);
  });
  qty.addEventListener('input', () => recalcBillRow(div));
  prc.addEventListener('input', () => recalcBillRow(div));
  div.querySelector('.mbill-del').addEventListener('click', () => { div.remove(); recalcBill(); });
}

function recalcBillRow(div) {
  const q=parseFloat(div.querySelector('.rq').value)||0;
  const p=parseFloat(div.querySelector('.rp').value)||0;
  div.querySelector('.rv').textContent = money(q*p);
  recalcBill();
}
document.getElementById('kuliInput').addEventListener('input', recalcBill);

function recalcBill() {
  let tot = 0;
  document.querySelectorAll('#billItemsBody .mbill-row').forEach(div => {
    const q=parseFloat(div.querySelector('.rq').value)||0;
    const p=parseFloat(div.querySelector('.rp').value)||0;
    tot += q*p;
  });
  const cust = findCustomer(document.getElementById('billCustomerSelect').value);
  const prev = cust ? (Number(cust.balance)||0) : 0;
  const kuli = parseFloat(document.getElementById('kuliInput').value)||0;
  document.getElementById('billTodayTotal').textContent = money(tot);
  document.getElementById('billPrevBalanceVal').textContent = money(prev);
  document.getElementById('billGrandTotal').textContent = money(tot+prev+kuli);
}

document.getElementById('clearBillBtn').addEventListener('click', () => {
  if (!confirm('இந்த பில்லை அழிக்கவா?')) return;
  document.getElementById('billItemsBody').innerHTML = '';
  document.getElementById('billCustomerSelect').value = '';
  document.getElementById('kuliInput').value = '';
  addBillRow(); updatePrevBal();
});

document.getElementById('saveBillBtn').addEventListener('click', async () => {
  const custId = document.getElementById('billCustomerSelect').value;
  if (!custId) { alert('வாடிக்கையாளரை தேர்வு செய்யவும்.'); return; }
  const rows = [];
  document.querySelectorAll('#billItemsBody .mbill-row').forEach(div => {
    const itemId = div.querySelector('.ri').value;
    const qty = parseFloat(div.querySelector('.rq').value)||0;
    const price = parseFloat(div.querySelector('.rp').value)||0;
    if (!itemId || qty <= 0) return;
    const it = findItem(itemId);
    rows.push({ name: it?it.name:'—', unit: it?it.unit:'', qty, price });
  });
  if (!rows.length) { alert('குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்.'); return; }
  const kuli = parseFloat(document.getElementById('kuliInput').value)||0;
  let bill;
  try {
    bill = await api('POST','/bills', { customerId: Number(custId), items: rows, kuli });
    [shop, customers] = await Promise.all([api('GET','/shop'), api('GET','/customers')]);
  } catch(e) { showErr(e); return; }
  document.getElementById('billItemsBody').innerHTML = '';
  document.getElementById('billCustomerSelect').value = '';
  document.getElementById('kuliInput').value = '';
  addBillRow(); fillCustSelect('billCustomerSelect'); updatePrevBal();
  openPrintModal(bill);
});

/* Quick add customer */
const custModal = document.getElementById('custModal');
document.getElementById('newCustomerQuickBtn').addEventListener('click', () => {
  ['qcName','qcPhone','qcBank'].forEach(id => document.getElementById(id).value='');
  document.getElementById('qcBalance').value=0;
  custModal.classList.remove('hidden');
  document.getElementById('qcName').focus();
});
document.getElementById('qcCancel').addEventListener('click', () => custModal.classList.add('hidden'));
document.getElementById('qcSave').addEventListener('click', async () => {
  const name = document.getElementById('qcName').value.trim();
  if (!name) { alert('பெயரை குறிப்பிடவும்.'); return; }
  let cust;
  try {
    cust = await api('POST','/customers', { name, phone: document.getElementById('qcPhone').value.trim(), bankDetails: document.getElementById('qcBank').value.trim(), balance: parseFloat(document.getElementById('qcBalance').value)||0 });
    customers = await api('GET','/customers');
  } catch(e) { showErr(e); return; }
  custModal.classList.add('hidden');
  fillCustSelect('billCustomerSelect');
  document.getElementById('billCustomerSelect').value = cust.id;
  updatePrevBal();
});

/* ============================================================
   PAYMENTS TAB
   ============================================================ */
async function renderPaymentsTab() {
  try { customers = await api('GET','/customers'); } catch(e) { showErr(e); return; }
  fillCustSelect('paymentCustomerSelect');
  document.getElementById('paymentDate').value = todayISO();
  refreshPayBal();
  await loadRecentPayments();
}
document.getElementById('paymentCustomerSelect').addEventListener('change', refreshPayBal);
function refreshPayBal() {
  const cust = findCustomer(document.getElementById('paymentCustomerSelect').value);
  document.getElementById('payBalStrong').textContent = money(cust ? cust.balance : 0);
}
document.getElementById('savePaymentBtn').addEventListener('click', async () => {
  const custId = document.getElementById('paymentCustomerSelect').value;
  if (!custId) { alert('வாடிக்கையாளரை தேர்வு செய்யவும்.'); return; }
  const amount = parseFloat(document.getElementById('paymentAmount').value)||0;
  if (amount <= 0) { alert('தொகையை சரியாக குறிப்பிடவும்.'); return; }
  try {
    await api('POST','/payments', { customerId: Number(custId), dateISO: document.getElementById('paymentDate').value||todayISO(), amount, mode: document.getElementById('paymentMode').value, reference: document.getElementById('paymentReference').value.trim() });
    customers = await api('GET','/customers');
  } catch(e) { showErr(e); return; }
  document.getElementById('paymentAmount').value='';
  document.getElementById('paymentReference').value='';
  refreshPayBal();
  await loadRecentPayments();
  alert('பணம் வெற்றிகரமாக பதிவு செய்யப்பட்டது ✓');
});
async function loadRecentPayments() {
  let list; try { list = await api('GET','/payments'); } catch(e) { showErr(e); return; }
  const tbody = document.querySelector('#paymentsTable tbody');
  tbody.innerHTML='';
  const recent = [...list].sort((a,b)=>b.createdAt-a.createdAt).slice(0,15);
  document.getElementById('paymentsEmpty').style.display = recent.length ? 'none' : 'block';
  recent.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmt(p.dateISO)}</td><td>${esc(p.customerName)}</td><td>${money(p.amount)}</td><td>${esc(p.mode)}</td><td>${money(p.balanceAfter)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ============================================================
   ITEMS TAB
   ============================================================ */
async function renderItemsTab() {
  try { items = await api('GET','/items'); } catch(e) { showErr(e); return; }
  const tbody = document.querySelector('#itemsTable tbody'); tbody.innerHTML='';
  document.getElementById('itemsCountLabel').textContent = `${items.length} பொருட்கள்`;
  [...items].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(it => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(it.name)}</td>
      <td><select class="ius" data-id="${it.id}">
        ${['கிலோ','எண்ணிக்கை','கட்டு','மூட்டை'].map(u=>`<option ${u===it.unit?'selected':''}>${u}</option>`).join('')}
      </select></td>
      <td><input type="number" class="ipr" data-id="${it.id}" value="${it.price}" min="0" step="0.5"></td>
      <td><button class="btn-danger-text idl" data-id="${it.id}">நீக்கு</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.ius').forEach(s=>s.addEventListener('change', async()=>{
    try{await api('PUT','/items/'+s.dataset.id,{unit:s.value});items=await api('GET','/items');}catch(e){showErr(e);}
  }));
  tbody.querySelectorAll('.ipr').forEach(i=>i.addEventListener('change', async()=>{
    try{await api('PUT','/items/'+i.dataset.id,{price:parseFloat(i.value)||0});items=await api('GET','/items');}catch(e){showErr(e);}
  }));
  tbody.querySelectorAll('.idl').forEach(b=>b.addEventListener('click', async()=>{
    if(!confirm('இந்த பொருளை நீக்கவா?')) return;
    try{await api('DELETE','/items/'+b.dataset.id);}catch(e){showErr(e);return;}
    renderItemsTab();
  }));
}
document.getElementById('addItemBtn').addEventListener('click', async()=>{
  const name=document.getElementById('newItemName').value.trim();
  if(!name){alert('பொருளின் பெயரை குறிப்பிடவும்.');return;}
  try{await api('POST','/items',{name,unit:document.getElementById('newItemUnit').value,price:parseFloat(document.getElementById('newItemPrice').value)||0});}
  catch(e){showErr(e);return;}
  document.getElementById('newItemName').value='';
  document.getElementById('newItemPrice').value='';
  renderItemsTab();
});

/* ============================================================
   CUSTOMERS TAB — card-based mobile layout
   ============================================================ */
async function renderCustomersTab() {
  try { customers = await api('GET','/customers'); } catch(e) { showErr(e); return; }
  document.getElementById('custCountLabel').textContent = `${customers.length} வாடிக்கையாளர்`;
  const container = document.getElementById('custCards');
  container.innerHTML = '';
  if (!customers.length) {
    container.innerHTML = '<div class="empty-state">வாடிக்கையாளர்கள் இல்லை.</div>';
    return;
  }
  [...customers].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(c => {
    const div = document.createElement('div');
    div.className = 'cust-card';
    div.innerHTML = `
      <div class="cust-card-top">
        <span class="cust-card-name">${esc(c.name)}</span>
        <span class="cust-card-bal">${money(c.balance)}</span>
      </div>
      ${c.phone?`<div class="cust-card-info">📱 ${esc(c.phone)}</div>`:''}
      ${c.bankDetails?`<div class="cust-card-info">🏦 ${esc(c.bankDetails)}</div>`:''}
      <div class="cust-card-actions">
        <button class="btn btn-secondary ldg" data-id="${c.id}">📒 கணக்கு</button>
        <button class="btn btn-ghost btn-sm cdl" data-id="${c.id}">🗑 நீக்கு</button>
      </div>`;
    container.appendChild(div);
  });
  container.querySelectorAll('.ldg').forEach(b=>b.addEventListener('click',()=>openLedger(b.dataset.id)));
  container.querySelectorAll('.cdl').forEach(b=>b.addEventListener('click', async()=>{
    const c=findCustomer(b.dataset.id);
    if(!confirm(`"${c.name}" -ஐ நீக்கவா?`)) return;
    try{await api('DELETE','/customers/'+b.dataset.id);}catch(e){showErr(e);return;}
    renderCustomersTab();
  }));
}
document.getElementById('addCustBtn').addEventListener('click', async()=>{
  const name=document.getElementById('newCustName').value.trim();
  if(!name){alert('பெயரை குறிப்பிடவும்.');return;}
  try{await api('POST','/customers',{name,phone:document.getElementById('newCustPhone').value.trim(),bankDetails:document.getElementById('newCustBank').value.trim(),balance:parseFloat(document.getElementById('newCustOpeningBalance').value)||0});}
  catch(e){showErr(e);return;}
  ['newCustName','newCustPhone','newCustBank','newCustOpeningBalance'].forEach(id=>document.getElementById(id).value='');
  renderCustomersTab();
});

/* ---- Ledger ---- */
const ledgerModal = document.getElementById('ledgerModal');
async function openLedger(customerId) {
  let data; try{data=await api('GET',`/customers/${customerId}/ledger`);}catch(e){showErr(e);return;}
  currentLedgerCustomer = data.customer;
  document.getElementById('ledgerTitle').textContent = `${data.customer.name} — கணக்கு`;
  document.getElementById('ledgerBalance').innerHTML = `பாக்கி: <strong>${money(data.customer.balance)}</strong>${data.customer.bankDetails?`<br>🏦 ${esc(data.customer.bankDetails)}`:''}`;
  const tbody=document.querySelector('#ledgerTable tbody'); tbody.innerHTML='';
  document.getElementById('ledgerEmpty').style.display=data.entries.length?'none':'block';
  data.entries.forEach(en=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${fmt(en.dateISO)}<br><span style="font-size:11px;color:#888">${en.timeDisplay||''}</span></td>
      <td>${esc(en.label)}</td>
      <td class="num-cell debit">${en.debit?plain(en.debit):''}</td>
      <td class="num-cell credit">${en.credit?plain(en.credit):''}</td>
      <td class="num-cell">${plain(en.balanceAfter)}</td>`;
    tbody.appendChild(tr);
  });
  ledgerModal.classList.remove('hidden');
}
document.getElementById('ledgerCloseBtn').addEventListener('click',()=>ledgerModal.classList.add('hidden'));
document.getElementById('ledgerDownloadBtn').addEventListener('click', async()=>{
  if(!currentLedgerCustomer) return;
  let data; try{data=await api('GET',`/customers/${currentLedgerCustomer.id}/ledger`);}catch(e){showErr(e);return;}
  let csv='தேதி,நேரம்,விவரம்,பில் (₹),பணம் (₹),பாக்கி (₹)\n';
  data.entries.forEach(en=>{csv+=`${fmt(en.dateISO)},${en.timeDisplay||''},"${en.label.replace(/"/g,'""')}",${en.debit?plain(en.debit):''},${en.credit?plain(en.credit):''},${plain(en.balanceAfter)}\n`;});
  dlCSV(csv,`statement_${data.customer.name}_${todayISO()}.csv`);
});

/* ============================================================
   REPORTS TAB
   ============================================================ */
async function renderReportsTab() {
  try { customers = await api('GET','/customers'); } catch(e) { showErr(e); return; }
  const cf=document.getElementById('selectCustomerFilter'),cfCur=cf.value;
  cf.innerHTML='<option value="">எல்லா வாடிக்கையாளர்</option>';
  [...customers].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(c=>{
    const o=document.createElement('option');o.value=c.id;o.textContent=c.name;cf.appendChild(o);
  });
  if(customers.some(c=>String(c.id)===cfCur))cf.value=cfCur;
}

(()=>{
  const to=todayISO(),fd=new Date();fd.setDate(fd.getDate()-30);
  const from=`${fd.getFullYear()}-${pad(fd.getMonth()+1)}-${pad(fd.getDate())}`;
  ['reportFrom','reportTo','selectFrom','selectTo'].forEach(id=>{
    const el=document.getElementById(id);
    el.value=id.includes('To')||id.includes('to')?to:from;
  });
})();

/* Bill selection */
document.getElementById('loadSelectBillsBtn').addEventListener('click', async()=>{
  const from=document.getElementById('selectFrom').value,to=document.getElementById('selectTo').value;
  const custId=document.getElementById('selectCustomerFilter').value;
  if(!from||!to){alert('தேதி வரம்பை தேர்வு செய்யவும்.');return;}
  let bills; try{bills=await api('GET',`/bills?from=${from}&to=${to}`);}catch(e){showErr(e);return;}
  if(custId)bills=bills.filter(b=>String(b.customerId)===custId);
  selectableBills=bills;
  const tbody=document.getElementById('selectBillsBody');
  tbody.innerHTML='';
  document.getElementById('selectBillsEmpty').style.display=bills.length?'none':'block';
  document.getElementById('selectCountBar').style.display=bills.length?'flex':'none';
  bills.forEach(b=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="checkbox" class="bill-chk" data-id="${b.id}" checked></td>
      <td>${b.billNo}</td><td>${fmt(b.dateISO)}</td><td>${esc(b.customerName)}</td>
      <td>${money(b.total)}</td><td>${b.kuli>0?money(b.kuli):'—'}</td><td>${money(b.grandTotal)}</td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.bill-chk').forEach(c=>c.addEventListener('change',updateSelectCount));
  updateSelectCount();
});

function updateSelectCount(){
  const all=document.querySelectorAll('#selectBillsBody .bill-chk');
  const checked=document.querySelectorAll('#selectBillsBody .bill-chk:checked');
  document.getElementById('selectedCount').textContent=checked.length;
  document.getElementById('printSelectedBtn').disabled=checked.length===0;
  document.getElementById('selectAllChk').checked=all.length>0&&all.length===checked.length;
}
document.getElementById('selectAllChk').addEventListener('change',function(){document.querySelectorAll('#selectBillsBody .bill-chk').forEach(c=>c.checked=this.checked);updateSelectCount();});
document.getElementById('selectAllBtn').addEventListener('click',()=>{document.querySelectorAll('#selectBillsBody .bill-chk').forEach(c=>c.checked=true);updateSelectCount();});
document.getElementById('deselectAllBtn').addEventListener('click',()=>{document.querySelectorAll('#selectBillsBody .bill-chk').forEach(c=>c.checked=false);updateSelectCount();});
document.getElementById('printSelectedBtn').addEventListener('click', async()=>{
  const ids=new Set([...document.querySelectorAll('#selectBillsBody .bill-chk:checked')].map(c=>Number(c.dataset.id)));
  const selected=selectableBills.filter(b=>ids.has(b.id));
  const area=document.getElementById('thermalPrintArea');
  area.innerHTML=selected.map(b=>buildThermalBill(b)).join('');
  window.print();
  setTimeout(()=>{area.innerHTML='';},2000);
});

/* Summary report */
document.getElementById('runReportBtn').addEventListener('click', async()=>{
  const from=document.getElementById('reportFrom').value,to=document.getElementById('reportTo').value;
  if(!from||!to){alert('தேதி வரம்பை தேர்வு செய்யவும்.');return;}
  let bills; try{bills=await api('GET',`/bills?from=${from}&to=${to}`);}catch(e){showErr(e);return;}
  lastReport={bills,from,to};
  document.getElementById('reportStats').style.display='grid';
  document.getElementById('reportSalesPanel').style.display='';
  const totalSales=bills.reduce((s,b)=>s+b.total,0);
  document.getElementById('reportBillCount').textContent=bills.length;
  document.getElementById('reportTotalSales').textContent=money(totalSales);
  document.getElementById('reportAvgBill').textContent=money(bills.length?totalSales/bills.length:0);
  const tbody=document.querySelector('#reportSalesTable tbody');tbody.innerHTML='';
  document.getElementById('reportSalesEmpty').style.display=bills.length?'none':'block';
  bills.forEach(b=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${b.billNo}</td><td>${fmt(b.dateISO)}</td><td>${esc(b.customerName)}</td><td>${money(b.total)}</td><td>${b.kuli>0?money(b.kuli):'—'}</td><td>${money(b.grandTotal)}</td><td><button class="btn btn-ghost btn-sm vb" data-id="${b.id}">🖨</button></td>`;tbody.appendChild(tr);});
  tbody.querySelectorAll('.vb').forEach(btn=>btn.addEventListener('click',()=>openPrintById(btn.dataset.id)));
});
document.getElementById('downloadSalesBtn').addEventListener('click',()=>{
  const{bills,from,to}=lastReport;if(!bills||!bills.length){alert('அறிக்கையில் பில் இல்லை.');return;}
  let csv='பில் எண்,தேதி,நேரம்,வாடிக்கையாளர்,இன்றைய தொகை,கூலி,முன் பாக்கி,மொத்தம்\n';
  bills.forEach(b=>csv+=`${b.billNo},${fmt(b.dateISO)},${b.timeDisplay||''},"${b.customerName.replace(/"/g,'""')}",${plain(b.total)},${plain(b.kuli||0)},${plain(b.prevBalance)},${plain(b.grandTotal)}\n`);
  dlCSV(csv,`sales_${from}_to_${to}.csv`);
});

/* ============================================================
   SETTINGS TAB
   ============================================================ */
async function renderSettingsTab() {
  try{shop=await api('GET','/shop');}catch(e){showErr(e);return;}
  document.getElementById('setShopName').value   =shop.name||'';
  document.getElementById('setShopSub').value    =shop.sub||'';
  document.getElementById('setShopAddress').value=shop.address||'';
  document.getElementById('setShopPhone').value  =shop.phone||'';
  document.getElementById('setOwnerName').value  =shop.owner||'';
  document.getElementById('setNextBillNo').value =shop.nextBillNo||1;
}
document.getElementById('saveSettingsBtn').addEventListener('click', async()=>{
  const patch={name:document.getElementById('setShopName').value.trim()||shop.name,sub:document.getElementById('setShopSub').value.trim(),address:document.getElementById('setShopAddress').value.trim(),phone:document.getElementById('setShopPhone').value.trim(),owner:document.getElementById('setOwnerName').value.trim(),nextBillNo:parseInt(document.getElementById('setNextBillNo').value,10)||shop.nextBillNo};
  try{shop=await api('PUT','/shop',patch);}catch(e){showErr(e);return;}
  document.getElementById('brandShopName').textContent=shop.name;
  const c=document.getElementById('settingsSaved');c.classList.add('show');setTimeout(()=>c.classList.remove('show'),2200);
});

/* Change Password */
document.getElementById('changePasswordBtn').addEventListener('click', async()=>{
  const cur=document.getElementById('currentPw').value;
  const nw=document.getElementById('newPw').value;
  const cf=document.getElementById('confirmPw').value;
  const errEl=document.getElementById('pwError');
  errEl.style.display='none';
  if(!cur||!nw){errEl.textContent='எல்லா புலங்களையும் நிரப்பவும்.';errEl.style.display='block';return;}
  if(nw!==cf){errEl.textContent='புதிய கடவுச்சொல்கள் பொருந்தவில்லை.';errEl.style.display='block';return;}
  try{
    const res=await api('POST','/change-password',{currentPassword:cur,newPassword:nw});
    AUTH_TOKEN=res.token;localStorage.setItem('vb_token',AUTH_TOKEN);
    document.getElementById('currentPw').value='';document.getElementById('newPw').value='';document.getElementById('confirmPw').value='';
    alert(res.message||'கடவுச்சொல் மாற்றப்பட்டது ✓');
  }catch(e){errEl.textContent=e.message;errEl.style.display='block';}
});

document.getElementById('logoutBtn').addEventListener('click',()=>{
  if(!confirm('வெளியேற வேண்டுமா?')) return;
  showLogin();
});

document.getElementById('exportDataBtn').addEventListener('click', async()=>{
  try{const d=await api('GET','/export');dlJSON(d,`veggie-backup_${todayISO()}.json`);}catch(e){showErr(e);}
});
document.getElementById('importDataInput').addEventListener('change', async(e)=>{
  const file=e.target.files[0];if(!file) return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{const data=JSON.parse(reader.result);if(!confirm('இப்போதைய தரவு மாற்றப்படும். தொடரவா?'))return;await api('POST','/import',data);alert('தரவு மீட்டமைக்கப்பட்டது.');await init();}
    catch(err){alert('பைலை படிக்க முடியவில்லை.');}
  };
  reader.readAsText(file);e.target.value='';
});

/* ============================================================
   THERMAL RECEIPT BUILDER
   ============================================================ */
function buildThermalBill(b) {
  const rows = b.items.map(it=>`<tr><td class="iname">${esc(it.name)}</td><td class="r">${it.qty}</td><td class="r">${plain(it.price)}</td><td class="r">${plain(it.value)}</td></tr>`).join('');
  const kuliRow = (b.kuli>0) ? `<div class="th-row"><span>கூலி</span><span class="r">${plain(b.kuli)}</span></div>` : '';
  return `
  <div class="thermal-bill">
    <div class="th-center">
      <div class="th-shop-name">${esc(shop.name||'')}</div>
      <div class="th-shop-sub">${esc(shop.sub||'')}</div>
      ${shop.address?`<div class="th-shop-info">${esc(shop.address)}</div>`:''}
      <div class="th-shop-info">CELL: ${esc(shop.phone||'')}</div>
      <div class="th-shop-info">உரிமை : ${esc(shop.owner||'')}</div>
    </div>
    <hr class="th-dash">
    <div class="th-meta"><span>Bill No. : ${b.billNo}</span><span>Date : ${fmt(b.dateISO)}</span></div>
    <div class="th-meta"><span>To : ${esc(b.customerName)}</span><span>Time : ${b.timeDisplay||''}</span></div>
    <hr class="th-dash">
    <table class="th-table">
      <thead><tr><th>பொருள்</th><th class="r">அளவு</th><th class="r">விலை</th><th class="r">மதிப்பு</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="th-dash">
    <div class="th-totals"><div class="th-row bold"><span>மொத்த தொகை</span><span class="r">${plain(b.total)}</span></div></div>
    <hr class="th-dash">
    <div class="th-totals">
      <div class="th-row"><span>முன் பாக்கி</span><span class="r">${plain(b.prevBalance)}</span></div>
      ${kuliRow}
      <div class="th-grand"><div class="th-row bold"><span>மொத்தம்</span><span class="r">${plain(b.grandTotal)}</span></div></div>
    </div>
    <div class="th-foot">நன்றி! மீண்டும் வரவும்.</div>
  </div>`;
}

/* ============================================================
   PRINT / DOWNLOAD IMAGE / SHARE
   ============================================================ */
const printModal = document.getElementById('printModal');

async function openPrintById(id) {
  try { openPrintModal(await api('GET','/bills/'+id)); } catch(e) { showErr(e); }
}
function openPrintModal(bill) {
  if (!bill) return;
  currentPrintBill = bill;
  document.getElementById('billPrintArea').innerHTML = buildThermalBill(bill);
  printModal.classList.remove('hidden');
}
document.getElementById('closePrintBtn').addEventListener('click',()=>{printModal.classList.add('hidden');currentPrintBill=null;});

document.getElementById('printBtn').addEventListener('click',()=>{
  const area = document.getElementById('thermalPrintArea');
  area.innerHTML = buildThermalBill(currentPrintBill);
  printModal.classList.add('hidden');
  window.print();
  setTimeout(()=>{area.innerHTML='';},2000);
});

/* ---- html2canvas image capture ---- */
async function captureBillCanvas(bill) {
  await document.fonts.ready;
  const dummy = document.getElementById('imageCaptureDummy');
  dummy.style.cssText = `
    position:fixed;left:-9999px;top:20px;width:320px;
    background:#fff;color:#111;padding:20px 16px;
    font-family:'Noto Sans Tamil',monospace;font-size:13px;
    line-height:1.6;visibility:visible;
  `;
  dummy.innerHTML = buildThermalBill(bill);
  // Apply inline styles to thermal bill classes (html2canvas needs computed styles)
  dummy.querySelectorAll('.th-center').forEach(el=>el.style.textAlign='center');
  dummy.querySelectorAll('.th-shop-name').forEach(el=>{el.style.fontFamily="'Baloo Thambi 2','Noto Sans Tamil',sans-serif";el.style.fontSize='18px';el.style.fontWeight='800';});
  dummy.querySelectorAll('.th-dash').forEach(el=>{el.style.border='none';el.style.borderTop='1px dashed #666';el.style.margin='8px 0';});
  dummy.querySelectorAll('.th-meta').forEach(el=>{el.style.display='flex';el.style.justifyContent='space-between';el.style.fontSize='12px';el.style.margin='3px 0';});
  dummy.querySelectorAll('.th-table').forEach(el=>{el.style.width='100%';el.style.borderCollapse='collapse';el.style.fontSize='12px';});
  dummy.querySelectorAll('.th-row').forEach(el=>{el.style.display='flex';el.style.justifyContent='space-between';el.style.padding='3px 2px';});
  dummy.querySelectorAll('.th-row.bold').forEach(el=>{el.style.fontWeight='700';el.style.fontSize='14px';});
  dummy.querySelectorAll('.th-grand').forEach(el=>{el.style.borderTop='1px solid #333';el.style.marginTop='4px';el.style.paddingTop='4px';});
  dummy.querySelectorAll('.th-grand .th-row').forEach(el=>{el.style.fontWeight='800';el.style.fontSize='15px';});
  dummy.querySelectorAll('.th-foot').forEach(el=>{el.style.textAlign='center';el.style.fontSize='11.5px';el.style.color='#555';el.style.marginTop='10px';});
  dummy.querySelectorAll('.th-table td.r,.th-table th.r').forEach(el=>el.style.textAlign='right');
  dummy.querySelectorAll('.thermal-bill').forEach(el=>{el.style.fontFamily="'Noto Sans Tamil',monospace";el.style.fontSize='12px';el.style.lineHeight='1.55';});

  const canvas = await html2canvas(dummy, {
    scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false
  });
  dummy.style.cssText = 'position:fixed;left:-9999px;visibility:hidden;';
  dummy.innerHTML = '';
  return canvas;
}

document.getElementById('downloadImgBtn').addEventListener('click', async()=>{
  if (!currentPrintBill) return;
  const loader = document.getElementById('imgLoader');
  loader.classList.remove('hidden');
  try {
    const canvas = await captureBillCanvas(currentPrintBill);
    const link = document.createElement('a');
    link.download = `bill_${currentPrintBill.billNo}_${currentPrintBill.customerName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(e) { alert('படம் உருவாக்க முடியவில்லை: '+e.message); }
  finally { loader.classList.add('hidden'); }
});

document.getElementById('shareBtn').addEventListener('click', async()=>{
  if (!currentPrintBill) return;
  const loader = document.getElementById('imgLoader');
  loader.classList.remove('hidden');
  try {
    const canvas = await captureBillCanvas(currentPrintBill);
    canvas.toBlob(async(blob)=>{
      const file = new File([blob], `bill_${currentPrintBill.billNo}.png`, { type:'image/png' });
      if (navigator.share && navigator.canShare({ files:[file] })) {
        await navigator.share({
          title: `பில் #${currentPrintBill.billNo} — ${currentPrintBill.customerName}`,
          files: [file]
        });
      } else {
        // Fallback: download
        const link = document.createElement('a');
        link.download = `bill_${currentPrintBill.billNo}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
      loader.classList.add('hidden');
    }, 'image/png');
  } catch(e) {
    loader.classList.add('hidden');
    if (e.name !== 'AbortError') alert('பகிர்வு தோல்வி: '+e.message);
  }
});

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  try {
    [shop, items, customers] = await Promise.all([
      api('GET','/shop'), api('GET','/items'), api('GET','/customers')
    ]);
    if (shop.name) {
      document.getElementById('brandShopName').textContent = shop.name;
      document.getElementById('loginShopName').textContent = shop.sub || shop.name;
    }
  } catch(e) {
    if (e.message === 'unauthorized') return;
    console.error(e);
  }
  await renderDashboard();
}

(async()=>{
  // Show login screen first — always verify token before loading app
  document.getElementById('loginScreen').classList.remove('hidden');
  if (AUTH_TOKEN) {
    // Try to auto-login with saved token
    try {
      const shopData = await fetch('/api/shop', {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      if (shopData.status === 401) { AUTH_TOKEN=''; localStorage.removeItem('vb_token'); }
      else {
        hideLogin();
        await init();
      }
    } catch(e) { /* server not ready, leave login screen */ }
  }
})();
