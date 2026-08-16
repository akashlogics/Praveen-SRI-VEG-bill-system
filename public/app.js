/* ============================================================
   காய்கறி பில்லிங் v3 — Thermal Printer Ready
   Changes: vehicleRent in bills, thermal 80mm print,
            bill selection & bulk print in reports
   ============================================================ */

const API = '/api';

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
  let res;
  try { res = await fetch(API + url, opts); }
  catch(e) { setServerStatus(false); throw new Error('சர்வருடன் இணைக்க முடியவில்லை.\nstart.bat-ஐ இயக்கி refresh செய்யவும்.'); }
  setServerStatus(true);
  let data; try { data = await res.json(); } catch(e) { data=null; }
  if (!res.ok) throw new Error((data&&data.error)||'ஏதோ தவறு நடந்தது');
  return data;
}

function setServerStatus(ok) {
  const el = document.getElementById('serverStatus');
  if (!el) return;
  el.classList.toggle('offline', !ok);
  el.innerHTML = ok ? 'தரவு பாதுகாப்பாக<br>சேமிக்கப்படும்' : '⚠️ சர்வர் இல்லை!<br>start.bat-ஐ இயக்கவும்';
}

/* -------- cached state -------- */
let shop = {}, items = [], customers = [], trucks = [];
let billRowCounter = 0, stockRowCounter = 0;
let currentPrintBill = null, currentLedgerCustomer = null;
let lastReport = { bills:[], stockTrips:[], salaries:[], from:'', to:'' };
let selectableBills = [];    // bills loaded in the selection panel

/* -------- utils -------- */
function money(n){ n=Number(n)||0; return '₹'+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function plain(n){ n=Number(n)||0; return n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pad(n){ return n.toString().padStart(2,'0'); }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmt(iso){ if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
function esc(s){ const div=document.createElement('div'); div.textContent=s??''; return div.innerHTML; }
function findItem(id)    { return items.find(x=>x.id===Number(id)); }
function findCustomer(id){ return customers.find(x=>x.id===Number(id)); }
function findTruck(id)   { return trucks.find(x=>x.id===Number(id)); }
function showErr(e)      { alert(e.message||String(e)); }

function dlCSV(content, name){
  const blob=new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function dlJSON(obj, name){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
});
async function switchTab(tab){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+tab));
  if(tab==='dashboard') await renderDashboard();
  if(tab==='newbill')   await renderNewBillTab();
  if(tab==='payments')  await renderPaymentsTab();
  if(tab==='items')     await renderItemsTab();
  if(tab==='customers') await renderCustomersTab();
  if(tab==='trucks')    await renderTrucksTab();
  if(tab==='reports')   await renderReportsTab();
  if(tab==='settings')  await renderSettingsTab();
}
document.getElementById('dashNewBillBtn').addEventListener('click',()=>switchTab('newbill'));

/* ============================================================
   DASHBOARD
   ============================================================ */
async function renderDashboard(){
  if(shop.name) document.getElementById('brandShopName').textContent=shop.name;
  const now=new Date();
  document.getElementById('todayDateDisplay').textContent=
    fmt(todayISO())+' • '+now.toLocaleDateString('ta-IN',{weekday:'long'});

  let d; try{d=await api('GET','/dashboard');}catch(e){showErr(e);return;}

  document.getElementById('statTodaySales').textContent    =money(d.todaySales);
  document.getElementById('statTodayBills').textContent    =`${d.todayCount} பில்கள்`;
  document.getElementById('statMonthSales').textContent    =money(d.monthSales);
  document.getElementById('statMonthBills').textContent    =`${d.monthCount} பில்கள்`;
  document.getElementById('statPending').textContent       =money(d.totalPending);
  document.getElementById('statCustomerCount').textContent =`${d.customerCount} வாடிக்கையாளர்`;
  document.getElementById('statItemCount').textContent     =d.itemCount;
  document.getElementById('statMonthPurchases').textContent=money(d.monthPurchases);
  document.getElementById('statMonthSalaries').textContent =money(d.monthSalaries);
  document.getElementById('statTruckCount').textContent    =`${d.truckCount} டிரக்குகள்`;

  const tbody=document.querySelector('#recentBillsTable tbody');
  tbody.innerHTML='';
  document.getElementById('recentBillsEmpty').style.display=d.recentBills.length?'none':'block';
  [...d.recentBills].reverse().forEach(b=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${b.billNo}</td><td>${fmt(b.dateISO)}</td><td>${esc(b.customerName)}</td>
      <td>${money(b.total)}</td><td>${money(b.grandTotal)}</td>
      <td><button class="btn btn-ghost vb" data-id="${b.id}">🖨 காண்க</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.vb').forEach(btn=>btn.addEventListener('click',()=>openPrintById(btn.dataset.id)));
}

/* ============================================================
   NEW BILL
   ============================================================ */
async function renderNewBillTab(){
  try{ [items,customers]=await Promise.all([api('GET','/items'),api('GET','/customers')]); }
  catch(e){showErr(e);return;}
  fillCustSelect('billCustomerSelect');
  updatePrevBal();
  if(!document.getElementById('billItemsBody').children.length) addBillRow();
  recalcBill();
}

function fillCustSelect(id){
  const sel=document.getElementById(id), cur=sel.value;
  sel.innerHTML='<option value="">-- தேர்வு செய்யவும் --</option>';
  [...customers].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(c=>{
    const o=document.createElement('option');
    o.value=c.id; o.textContent=c.name+(c.phone?` (${c.phone})`:'');
    sel.appendChild(o);
  });
  if(customers.some(c=>String(c.id)===cur)) sel.value=cur;
}

document.getElementById('billCustomerSelect').addEventListener('change',updatePrevBal);
function updatePrevBal(){
  const cust=findCustomer(document.getElementById('billCustomerSelect').value);
  const prev=cust?(Number(cust.balance)||0):0;
  document.querySelector('#prevBalanceLine strong').textContent=money(prev);
  document.getElementById('billPrevBalanceVal').textContent=money(prev);
  recalcBill();
}

document.getElementById('addItemRowBtn').addEventListener('click',addBillRow);
function addBillRow(){
  const tbody=document.getElementById('billItemsBody');
  const tr=document.createElement('tr');
  tr.dataset.rowId=++billRowCounter;
  const opts=['<option value="">-- பொருள் --</option>',
    ...items.map(it=>`<option value="${it.id}">${esc(it.name)}</option>`)].join('');
  tr.innerHTML=`
    <td class="col-item"><select class="ri">${opts}</select></td>
    <td class="col-qty"><input type="number" class="rq" min="0" step="0.5" placeholder="0"></td>
    <td class="col-unit"><span class="ru muted">—</span></td>
    <td class="col-price"><input type="number" class="rp" min="0" step="0.5" placeholder="0.00"></td>
    <td class="col-value"><span class="rv">₹0.00</span></td>
    <td class="col-del"><button class="row-del-btn">✕</button></td>`;
  tbody.appendChild(tr);
  const sel=tr.querySelector('.ri'),qty=tr.querySelector('.rq'),
        prc=tr.querySelector('.rp'),unit=tr.querySelector('.ru');
  sel.addEventListener('change',()=>{
    const it=findItem(sel.value);
    if(it){unit.textContent=it.unit;unit.classList.remove('muted');prc.value=it.price;}
    else  {unit.textContent='—';unit.classList.add('muted');prc.value='';}
    recalcBillRow(tr);
  });
  qty.addEventListener('input',()=>recalcBillRow(tr));
  prc.addEventListener('input',()=>recalcBillRow(tr));
  tr.querySelector('.row-del-btn').addEventListener('click',()=>{tr.remove();recalcBill();});
}
function recalcBillRow(tr){
  const q=parseFloat(tr.querySelector('.rq').value)||0, p=parseFloat(tr.querySelector('.rp').value)||0;
  tr.querySelector('.rv').textContent=money(q*p);
  recalcBill();
}

document.getElementById('vehicleRentInput').addEventListener('input',recalcBill);
function recalcBill(){
  let tot=0;
  document.querySelectorAll('#billItemsBody tr').forEach(tr=>{
    tot+=(parseFloat(tr.querySelector('.rq').value)||0)*(parseFloat(tr.querySelector('.rp').value)||0);
  });
  const cust=findCustomer(document.getElementById('billCustomerSelect').value);
  const prev=cust?(Number(cust.balance)||0):0;
  const vr=parseFloat(document.getElementById('vehicleRentInput').value)||0;
  document.getElementById('billTodayTotal').textContent  =money(tot);
  document.getElementById('billPrevBalanceVal').textContent=money(prev);
  document.getElementById('billGrandTotal').textContent  =money(tot+prev+vr);
}

document.getElementById('clearBillBtn').addEventListener('click',()=>{
  if(!confirm('இந்த பில்லை அழிக்கவா?')) return;
  document.getElementById('billItemsBody').innerHTML='';
  document.getElementById('billCustomerSelect').value='';
  document.getElementById('vehicleRentInput').value='';
  addBillRow(); updatePrevBal();
});

document.getElementById('saveBillBtn').addEventListener('click', async()=>{
  const custId=document.getElementById('billCustomerSelect').value;
  if(!custId){alert('வாடிக்கையாளரை தேர்வு செய்யவும்.');return;}
  const rows=[];
  document.querySelectorAll('#billItemsBody tr').forEach(tr=>{
    const itemId=tr.querySelector('.ri').value;
    const qty=parseFloat(tr.querySelector('.rq').value)||0;
    const price=parseFloat(tr.querySelector('.rp').value)||0;
    if(!itemId||qty<=0) return;
    const it=findItem(itemId);
    rows.push({name:it?it.name:'—',unit:it?it.unit:'',qty,price});
  });
  if(!rows.length){alert('குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்.');return;}
  const vehicleRent=parseFloat(document.getElementById('vehicleRentInput').value)||0;
  let bill;
  try{
    bill=await api('POST','/bills',{customerId:Number(custId),items:rows,vehicleRent});
    [shop,customers]=await Promise.all([api('GET','/shop'),api('GET','/customers')]);
  }catch(e){showErr(e);return;}
  document.getElementById('billItemsBody').innerHTML='';
  document.getElementById('billCustomerSelect').value='';
  document.getElementById('vehicleRentInput').value='';
  addBillRow(); fillCustSelect('billCustomerSelect'); updatePrevBal();
  openPrintModal(bill);
});

/* ---- Quick add customer from new-bill tab ---- */
const custModal=document.getElementById('custModal');
document.getElementById('newCustomerQuickBtn').addEventListener('click',()=>{
  ['qcName','qcPhone','qcBank'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('qcBalance').value=0;
  custModal.classList.remove('hidden');
  document.getElementById('qcName').focus();
});
document.getElementById('qcCancel').addEventListener('click',()=>custModal.classList.add('hidden'));
document.getElementById('qcSave').addEventListener('click', async()=>{
  const name=document.getElementById('qcName').value.trim();
  if(!name){alert('பெயரை குறிப்பிடவும்.');return;}
  let cust;
  try{
    cust=await api('POST','/customers',{
      name,phone:document.getElementById('qcPhone').value.trim(),
      bankDetails:document.getElementById('qcBank').value.trim(),
      balance:parseFloat(document.getElementById('qcBalance').value)||0
    });
    customers=await api('GET','/customers');
  }catch(e){showErr(e);return;}
  custModal.classList.add('hidden');
  fillCustSelect('billCustomerSelect');
  document.getElementById('billCustomerSelect').value=cust.id;
  updatePrevBal();
});

/* ============================================================
   PAYMENTS TAB
   ============================================================ */
async function renderPaymentsTab(){
  try{customers=await api('GET','/customers');}catch(e){showErr(e);return;}
  fillCustSelect('paymentCustomerSelect');
  document.getElementById('paymentDate').value=todayISO();
  refreshPayBal();
  await loadRecentPayments();
}
document.getElementById('paymentCustomerSelect').addEventListener('change',refreshPayBal);
function refreshPayBal(){
  const cust=findCustomer(document.getElementById('paymentCustomerSelect').value);
  document.querySelector('#paymentBalancePreview strong').textContent=money(cust?cust.balance:0);
}
document.getElementById('savePaymentBtn').addEventListener('click', async()=>{
  const custId=document.getElementById('paymentCustomerSelect').value;
  if(!custId){alert('வாடிக்கையாளரை தேர்வு செய்யவும்.');return;}
  const amount=parseFloat(document.getElementById('paymentAmount').value)||0;
  if(amount<=0){alert('தொகையை சரியாக குறிப்பிடவும்.');return;}
  try{
    await api('POST','/payments',{
      customerId:Number(custId),
      dateISO:document.getElementById('paymentDate').value||todayISO(),
      amount,mode:document.getElementById('paymentMode').value,
      reference:document.getElementById('paymentReference').value.trim()
    });
    customers=await api('GET','/customers');
  }catch(e){showErr(e);return;}
  document.getElementById('paymentAmount').value='';
  document.getElementById('paymentReference').value='';
  refreshPayBal();
  await loadRecentPayments();
  alert('பணம் வெற்றிகரமாக பதிவு செய்யப்பட்டது ✓');
});
async function loadRecentPayments(){
  let list; try{list=await api('GET','/payments');}catch(e){showErr(e);return;}
  const tbody=document.querySelector('#paymentsTable tbody');
  tbody.innerHTML='';
  const recent=[...list].sort((a,b)=>b.createdAt-a.createdAt).slice(0,15);
  document.getElementById('paymentsEmpty').style.display=recent.length?'none':'block';
  recent.forEach(p=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${fmt(p.dateISO)}</td><td>${esc(p.customerName)}</td>
      <td>${money(p.amount)}</td><td>${esc(p.mode)}</td>
      <td>${esc(p.reference||'—')}</td><td>${money(p.balanceAfter)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ============================================================
   ITEMS TAB
   ============================================================ */
async function renderItemsTab(){
  try{items=await api('GET','/items');}catch(e){showErr(e);return;}
  const tbody=document.querySelector('#itemsTable tbody');
  tbody.innerHTML='';
  document.getElementById('itemsCountLabel').textContent=`${items.length} பொருட்கள்`;
  [...items].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(it=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${esc(it.name)}</td>
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
   CUSTOMERS TAB
   ============================================================ */
async function renderCustomersTab(){
  try{customers=await api('GET','/customers');}catch(e){showErr(e);return;}
  const tbody=document.querySelector('#customersTable tbody');
  tbody.innerHTML='';
  document.getElementById('custCountLabel').textContent=`${customers.length} வாடிக்கையாளர்`;
  [...customers].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(c=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><div style="font-weight:600">${esc(c.name)}</div>
        <button class="btn btn-ghost ldg" data-id="${c.id}" style="margin-top:5px;padding:4px 10px;font-size:12px;">📒 கணக்கு பட்டியல்</button></td>
      <td><input type="tel" class="cph" data-id="${c.id}" value="${esc(c.phone||'')}" placeholder="91XXXXXXXXXX"></td>
      <td><input type="text" class="cbk" data-id="${c.id}" value="${esc(c.bankDetails||'')}" placeholder="வங்கி விவரம்"></td>
      <td><input type="number" class="cbl" data-id="${c.id}" value="${c.balance}" step="1"></td>
      <td><button class="btn-danger-text cdl" data-id="${c.id}">நீக்கு</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.cph').forEach(i=>i.addEventListener('change', async()=>{
    try{await api('PUT','/customers/'+i.dataset.id,{phone:i.value.trim()});customers=await api('GET','/customers');}catch(e){showErr(e);}
  }));
  tbody.querySelectorAll('.cbk').forEach(i=>i.addEventListener('change', async()=>{
    try{await api('PUT','/customers/'+i.dataset.id,{bankDetails:i.value.trim()});customers=await api('GET','/customers');}catch(e){showErr(e);}
  }));
  tbody.querySelectorAll('.cbl').forEach(i=>i.addEventListener('change', async()=>{
    try{await api('PUT','/customers/'+i.dataset.id,{balance:parseFloat(i.value)||0});customers=await api('GET','/customers');}catch(e){showErr(e);}
  }));
  tbody.querySelectorAll('.cdl').forEach(b=>b.addEventListener('click', async()=>{
    const c=findCustomer(b.dataset.id);
    if(!confirm(`"${c.name}" -ஐ நீக்கவா?`)) return;
    try{await api('DELETE','/customers/'+b.dataset.id);}catch(e){showErr(e);return;}
    renderCustomersTab();
  }));
  tbody.querySelectorAll('.ldg').forEach(b=>b.addEventListener('click',()=>openLedger(b.dataset.id)));
}
document.getElementById('addCustBtn').addEventListener('click', async()=>{
  const name=document.getElementById('newCustName').value.trim();
  if(!name){alert('பெயரை குறிப்பிடவும்.');return;}
  try{await api('POST','/customers',{
    name,phone:document.getElementById('newCustPhone').value.trim(),
    bankDetails:document.getElementById('newCustBank').value.trim(),
    balance:parseFloat(document.getElementById('newCustOpeningBalance').value)||0
  });}catch(e){showErr(e);return;}
  ['newCustName','newCustPhone','newCustBank','newCustOpeningBalance'].forEach(id=>document.getElementById(id).value='');
  renderCustomersTab();
});

/* ---- Ledger modal ---- */
const ledgerModal=document.getElementById('ledgerModal');
async function openLedger(customerId){
  let data; try{data=await api('GET',`/customers/${customerId}/ledger`);}catch(e){showErr(e);return;}
  currentLedgerCustomer=data.customer;
  document.getElementById('ledgerTitle').textContent=`கணக்கு பட்டியல் — ${data.customer.name}`;
  document.getElementById('ledgerBalance').innerHTML=
    `தற்போதைய பாக்கி: <strong>${money(data.customer.balance)}</strong>`+
    (data.customer.bankDetails?`<br>வங்கி: ${esc(data.customer.bankDetails)}`:'');
  const tbody=document.querySelector('#ledgerTable tbody');
  tbody.innerHTML='';
  document.getElementById('ledgerEmpty').style.display=data.entries.length?'none':'block';
  data.entries.forEach(en=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${fmt(en.dateISO)}<br><span class="muted" style="font-size:11px">${en.timeDisplay||''}</span></td>
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
  data.entries.forEach(en=>{
    csv+=`${fmt(en.dateISO)},${en.timeDisplay||''},"${en.label.replace(/"/g,'""')}",${en.debit?plain(en.debit):''},${en.credit?plain(en.credit):''},${plain(en.balanceAfter)}\n`;
  });
  dlCSV(csv,`statement_${data.customer.name}_${todayISO()}.csv`);
});

/* ============================================================
   TRUCKS & STOCK TAB
   ============================================================ */
async function renderTrucksTab(){
  try{[trucks,items]=await Promise.all([api('GET','/trucks'),api('GET','/items')]);}catch(e){showErr(e);return;}
  buildTrucksTable();
  fillTruckSelect('stockTruckSelect'); fillTruckSelect('salaryTruckSelect');
  document.getElementById('stockDate').value=todayISO();
  document.getElementById('salaryDate').value=todayISO();
  if(!document.getElementById('stockItemsBody').children.length) addStockRow();
  recalcStockTotal();
  await loadStockTrips(); await loadSalaries();
}
function buildTrucksTable(){
  const tbody=document.querySelector('#trucksTable tbody');
  tbody.innerHTML='';
  document.getElementById('trucksCountLabel').textContent=`${trucks.length} டிரக்குகள்`;
  document.getElementById('trucksEmpty').style.display=trucks.length?'none':'block';
  trucks.forEach(t=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="text" class="tn" data-id="${t.id}" value="${esc(t.number)}"></td>
      <td><input type="text" class="tdr" data-id="${t.id}" value="${esc(t.driverName||'')}"></td>
      <td><input type="tel" class="tph" data-id="${t.id}" value="${esc(t.driverPhone||'')}"></td>
      <td><button class="btn-danger-text tdl" data-id="${t.id}">நீக்கு</button></td>`;
    tbody.appendChild(tr);
  });
  const upd=(field,cls)=>tbody.querySelectorAll(cls).forEach(i=>i.addEventListener('change', async()=>{
    try{await api('PUT','/trucks/'+i.dataset.id,{[field]:i.value.trim()});trucks=await api('GET','/trucks');fillTruckSelect('stockTruckSelect');fillTruckSelect('salaryTruckSelect');}catch(e){showErr(e);}
  }));
  upd('number','.tn');upd('driverName','.tdr');upd('driverPhone','.tph');
  tbody.querySelectorAll('.tdl').forEach(b=>b.addEventListener('click', async()=>{
    if(!confirm('இந்த டிரக்கை நீக்கவா?')) return;
    try{await api('DELETE','/trucks/'+b.dataset.id);trucks=await api('GET','/trucks');}catch(e){showErr(e);return;}
    buildTrucksTable();fillTruckSelect('stockTruckSelect');fillTruckSelect('salaryTruckSelect');
  }));
}
document.getElementById('addTruckBtn').addEventListener('click', async()=>{
  const number=document.getElementById('newTruckNumber').value.trim();
  if(!number){alert('டிரக் எண்ணை குறிப்பிடவும்.');return;}
  try{await api('POST','/trucks',{number,driverName:document.getElementById('newTruckDriver').value.trim(),driverPhone:document.getElementById('newTruckPhone').value.trim()});trucks=await api('GET','/trucks');}
  catch(e){showErr(e);return;}
  ['newTruckNumber','newTruckDriver','newTruckPhone'].forEach(id=>document.getElementById(id).value='');
  buildTrucksTable();fillTruckSelect('stockTruckSelect');fillTruckSelect('salaryTruckSelect');
});
function fillTruckSelect(id){
  const sel=document.getElementById(id),cur=sel.value;
  sel.innerHTML='<option value="">-- டிரக் தேர்வு செய்யவும் --</option>';
  trucks.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=`${t.number}${t.driverName?' — '+t.driverName:''}`;sel.appendChild(o);});
  if(trucks.some(t=>String(t.id)===cur))sel.value=cur;
}
document.getElementById('addStockRowBtn').addEventListener('click',addStockRow);
function addStockRow(){
  const tbody=document.getElementById('stockItemsBody');
  const tr=document.createElement('tr');tr.dataset.rowId=++stockRowCounter;
  const opts=['<option value="">-- பொருள் --</option>',...items.map(it=>`<option value="${it.id}">${esc(it.name)}</option>`)].join('');
  tr.innerHTML=`<td class="col-item"><select class="si">${opts}</select></td>
    <td class="col-qty"><input type="number" class="sq" min="0" step="0.5" placeholder="0"></td>
    <td class="col-unit"><span class="su muted">—</span></td>
    <td class="col-price"><input type="number" class="sp" min="0" step="0.5" placeholder="0.00"></td>
    <td class="col-value"><span class="sv">₹0.00</span></td>
    <td class="col-del"><button class="row-del-btn">✕</button></td>`;
  tbody.appendChild(tr);
  const sel=tr.querySelector('.si'),qty=tr.querySelector('.sq'),prc=tr.querySelector('.sp'),unit=tr.querySelector('.su');
  sel.addEventListener('change',()=>{const it=findItem(sel.value);if(it){unit.textContent=it.unit;unit.classList.remove('muted');}else{unit.textContent='—';unit.classList.add('muted');}recalcStockRow(tr);});
  qty.addEventListener('input',()=>recalcStockRow(tr));
  prc.addEventListener('input',()=>recalcStockRow(tr));
  tr.querySelector('.row-del-btn').addEventListener('click',()=>{tr.remove();recalcStockTotal();});
}
function recalcStockRow(tr){const q=parseFloat(tr.querySelector('.sq').value)||0,p=parseFloat(tr.querySelector('.sp').value)||0;tr.querySelector('.sv').textContent=money(q*p);recalcStockTotal();}
function recalcStockTotal(){let tot=0;document.querySelectorAll('#stockItemsBody tr').forEach(tr=>{tot+=(parseFloat(tr.querySelector('.sq').value)||0)*(parseFloat(tr.querySelector('.sp').value)||0);});document.getElementById('stockTotal').textContent=money(tot);}
document.getElementById('saveStockBtn').addEventListener('click', async()=>{
  const truckId=document.getElementById('stockTruckSelect').value;
  if(!truckId){alert('டிரக்கை தேர்வு செய்யவும்.');return;}
  const rows=[];
  document.querySelectorAll('#stockItemsBody tr').forEach(tr=>{
    const itemId=tr.querySelector('.si').value,qty=parseFloat(tr.querySelector('.sq').value)||0,price=parseFloat(tr.querySelector('.sp').value)||0;
    if(!itemId||qty<=0) return;
    const it=findItem(itemId);rows.push({name:it?it.name:'—',unit:it?it.unit:'',qty,price});
  });
  if(!rows.length){alert('குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்.');return;}
  try{await api('POST','/stock-trips',{truckId:Number(truckId),dateISO:document.getElementById('stockDate').value||todayISO(),items:rows,notes:document.getElementById('stockNotes').value.trim()});}
  catch(e){showErr(e);return;}
  document.getElementById('stockItemsBody').innerHTML='';document.getElementById('stockNotes').value='';
  addStockRow();recalcStockTotal();await loadStockTrips();
  alert('சரக்கு பதிவு சேமிக்கப்பட்டது ✓');
});
async function loadStockTrips(){
  let list;try{list=await api('GET','/stock-trips');}catch(e){showErr(e);return;}
  const tbody=document.querySelector('#stockTripsTable tbody');tbody.innerHTML='';
  const recent=[...list].sort((a,b)=>b.createdAt-a.createdAt).slice(0,12);
  document.getElementById('stockTripsEmpty').style.display=recent.length?'none':'block';
  recent.forEach(t=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${fmt(t.dateISO)}</td><td>${esc(t.truckNumber)}</td><td>${esc(t.driverName||'—')}</td><td class="items-list-cell">${esc(t.items.map(it=>`${it.name} (${it.qty}${it.unit})`).join(', '))}</td><td>${money(t.totalCost)}</td>`;tbody.appendChild(tr);});
}
document.getElementById('saveSalaryBtn').addEventListener('click', async()=>{
  const truckId=document.getElementById('salaryTruckSelect').value;
  if(!truckId){alert('டிரைவரை தேர்வு செய்யவும்.');return;}
  const amount=parseFloat(document.getElementById('salaryAmount').value)||0;
  if(amount<=0){alert('தொகையை சரியாக குறிப்பிடவும்.');return;}
  try{await api('POST','/salaries',{truckId:Number(truckId),dateISO:document.getElementById('salaryDate').value||todayISO(),amount,notes:document.getElementById('salaryNotes').value.trim()});}
  catch(e){showErr(e);return;}
  document.getElementById('salaryAmount').value='';document.getElementById('salaryNotes').value='';
  await loadSalaries();alert('சம்பளம் பதிவு சேமிக்கப்பட்டது ✓');
});
async function loadSalaries(){
  let list;try{list=await api('GET','/salaries');}catch(e){showErr(e);return;}
  const tbody=document.querySelector('#salaryTable tbody');tbody.innerHTML='';
  const recent=[...list].sort((a,b)=>b.createdAt-a.createdAt).slice(0,12);
  document.getElementById('salaryEmpty').style.display=recent.length?'none':'block';
  recent.forEach(s=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${fmt(s.dateISO)}</td><td>${esc(s.truckNumber||'—')}</td><td>${esc(s.driverName||'—')}</td><td>${money(s.amount)}</td><td>${esc(s.notes||'—')}</td>`;tbody.appendChild(tr);});
}

/* ============================================================
   REPORTS TAB
   ============================================================ */
async function renderReportsTab(){
  try{customers=await api('GET','/customers');}catch(e){showErr(e);return;}
  // Populate customer filter in bill selection panel
  const cf=document.getElementById('selectCustomerFilter');
  const cfCur=cf.value;
  cf.innerHTML='<option value="">எல்லா வாடிக்கையாளர்</option>';
  [...customers].sort((a,b)=>a.name.localeCompare(b.name,'ta')).forEach(c=>{
    const o=document.createElement('option');o.value=c.id;o.textContent=c.name;cf.appendChild(o);
  });
  if(customers.some(c=>String(c.id)===cfCur)) cf.value=cfCur;
}

/* ---- Date defaults ---- */
(()=>{
  const to=todayISO(),fd=new Date();fd.setDate(fd.getDate()-30);
  const from=`${fd.getFullYear()}-${pad(fd.getMonth()+1)}-${pad(fd.getDate())}`;
  document.getElementById('reportFrom').value=from;
  document.getElementById('reportTo').value=to;
  document.getElementById('selectFrom').value=from;
  document.getElementById('selectTo').value=to;
})();

/* ============================================================
   BILL SELECTION & THERMAL BULK PRINT
   ============================================================ */
document.getElementById('loadSelectBillsBtn').addEventListener('click', async()=>{
  const from=document.getElementById('selectFrom').value;
  const to  =document.getElementById('selectTo').value;
  const custId=document.getElementById('selectCustomerFilter').value;
  if(!from||!to){alert('தேதி வரம்பை தேர்வு செய்யவும்.');return;}

  let bills; try{bills=await api('GET',`/bills?from=${from}&to=${to}`);}catch(e){showErr(e);return;}
  if(custId) bills=bills.filter(b=>String(b.customerId)===custId);
  selectableBills=bills;

  const tbody=document.getElementById('selectBillsBody');
  tbody.innerHTML='';
  document.getElementById('selectBillsEmpty').style.display=bills.length?'none':'block';
  document.getElementById('selectCountBar').style.display=bills.length?'flex':'none';

  bills.forEach(b=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="chk-col"><input type="checkbox" class="bill-chk" data-id="${b.id}" checked></td>
      <td>${b.billNo}</td>
      <td>${fmt(b.dateISO)}</td>
      <td>${b.timeDisplay||''}</td>
      <td>${esc(b.customerName)}</td>
      <td>${money(b.total)}</td>
      <td>${b.vehicleRent>0?money(b.vehicleRent):'—'}</td>
      <td>${money(b.grandTotal)}</td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.bill-chk').forEach(chk=>chk.addEventListener('change',updateSelectCount));
  updateSelectCount();
});

function updateSelectCount(){
  const all=document.querySelectorAll('#selectBillsBody .bill-chk');
  const checked=document.querySelectorAll('#selectBillsBody .bill-chk:checked');
  document.getElementById('selectedCount').textContent=checked.length;
  document.getElementById('printSelectedBtn').disabled=checked.length===0;
  document.getElementById('selectAllChk').checked=all.length>0&&all.length===checked.length;
}

document.getElementById('selectAllChk').addEventListener('change',function(){
  document.querySelectorAll('#selectBillsBody .bill-chk').forEach(chk=>chk.checked=this.checked);
  updateSelectCount();
});
document.getElementById('selectAllBtn').addEventListener('click',()=>{
  document.querySelectorAll('#selectBillsBody .bill-chk').forEach(chk=>chk.checked=true);
  updateSelectCount();
});
document.getElementById('deselectAllBtn').addEventListener('click',()=>{
  document.querySelectorAll('#selectBillsBody .bill-chk').forEach(chk=>chk.checked=false);
  updateSelectCount();
});

document.getElementById('printSelectedBtn').addEventListener('click', async()=>{
  const selectedIds=new Set(
    [...document.querySelectorAll('#selectBillsBody .bill-chk:checked')].map(chk=>Number(chk.dataset.id))
  );
  if(!selectedIds.size){alert('ஒரு பில் கூட தேர்வு செய்யப்படவில்லை.');return;}

  // Fetch full bill data for each selected bill
  const selected=selectableBills.filter(b=>selectedIds.has(b.id));

  // Build thermal HTML for all selected bills
  const area=document.getElementById('thermalPrintArea');
  area.innerHTML=selected.map(b=>buildThermalBill(b)).join('');

  // Print
  window.print();

  // Clean up after print dialog closes
  setTimeout(()=>{area.innerHTML='';},2000);
});

/* ============================================================
   SUMMARY REPORTS
   ============================================================ */
document.getElementById('runReportBtn').addEventListener('click', async()=>{
  const from=document.getElementById('reportFrom').value,to=document.getElementById('reportTo').value;
  if(!from||!to){alert('தேதி வரம்பை தேர்வு செய்யவும்.');return;}
  let bills,stockTrips,salaries;
  try{[bills,stockTrips,salaries]=await Promise.all([
    api('GET',`/bills?from=${from}&to=${to}`),
    api('GET',`/stock-trips?from=${from}&to=${to}`),
    api('GET',`/salaries?from=${from}&to=${to}`)
  ]);}catch(e){showErr(e);return;}
  lastReport={bills,stockTrips,salaries,from,to};
  document.getElementById('reportEmptyAll').style.display='none';
  document.getElementById('reportStats').style.display='grid';
  [document.getElementById('reportSalesPanel'),
   document.getElementById('reportStockPanel'),
   document.getElementById('reportSalaryPanel')].forEach(el=>el.style.display='');

  const totalSales=bills.reduce((s,b)=>s+b.total,0);
  document.getElementById('reportBillCount').textContent=bills.length;
  document.getElementById('reportTotalSales').textContent=money(totalSales);
  document.getElementById('reportAvgBill').textContent=money(bills.length?totalSales/bills.length:0);
  document.getElementById('reportTotalPurchases').textContent=money(stockTrips.reduce((s,t)=>s+t.totalCost,0));
  document.getElementById('reportTotalSalaries').textContent=money(salaries.reduce((s,x)=>s+x.amount,0));

  const stb=document.querySelector('#reportSalesTable tbody');stb.innerHTML='';
  document.getElementById('reportSalesEmpty').style.display=bills.length?'none':'block';
  bills.forEach(b=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${b.billNo}</td><td>${fmt(b.dateISO)}</td><td>${b.timeDisplay}</td>
      <td>${esc(b.customerName)}</td><td>${money(b.total)}</td>
      <td>${b.vehicleRent>0?money(b.vehicleRent):'—'}</td><td>${money(b.grandTotal)}</td>
      <td><button class="btn btn-ghost vb" data-id="${b.id}">🖨</button></td>`;
    stb.appendChild(tr);
  });
  stb.querySelectorAll('.vb').forEach(btn=>btn.addEventListener('click',()=>openPrintById(btn.dataset.id)));

  const sktb=document.querySelector('#reportStockTable tbody');sktb.innerHTML='';
  document.getElementById('reportStockEmpty').style.display=stockTrips.length?'none':'block';
  stockTrips.forEach(t=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${fmt(t.dateISO)}</td><td>${esc(t.truckNumber)}</td><td>${esc(t.driverName||'—')}</td><td class="items-list-cell">${esc(t.items.map(it=>`${it.name} ${it.qty}${it.unit}`).join(', '))}</td><td>${money(t.totalCost)}</td>`;sktb.appendChild(tr);});
  const saltb=document.querySelector('#reportSalaryTable tbody');saltb.innerHTML='';
  document.getElementById('reportSalaryEmpty').style.display=salaries.length?'none':'block';
  salaries.forEach(s=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${fmt(s.dateISO)}</td><td>${esc(s.truckNumber||'—')}</td><td>${esc(s.driverName||'—')}</td><td>${money(s.amount)}</td><td>${esc(s.notes||'—')}</td>`;saltb.appendChild(tr);});
});

document.getElementById('downloadSalesBtn').addEventListener('click',()=>{
  const{bills,from,to}=lastReport;if(!bills.length){alert('அறிக்கையில் பில் இல்லை.');return;}
  let csv='பில் எண்,தேதி,நேரம்,வாடிக்கையாளர்,இன்றைய தொகை,வண்டி வாடகை,முன் பாக்கி,மொத்தம்\n';
  bills.forEach(b=>csv+=`${b.billNo},${fmt(b.dateISO)},${b.timeDisplay},"${b.customerName.replace(/"/g,'""')}",${plain(b.total)},${plain(b.vehicleRent||0)},${plain(b.prevBalance)},${plain(b.grandTotal)}\n`);
  dlCSV(csv,`sales_${from}_to_${to}.csv`);
});
document.getElementById('downloadStockBtn').addEventListener('click',()=>{
  const{stockTrips,from,to}=lastReport;if(!stockTrips.length){alert('சரக்கு பதிவு இல்லை.');return;}
  let csv='தேதி,டிரக்,டிரைவர்,பொருட்கள்,மொத்தம்\n';
  stockTrips.forEach(t=>{csv+=`${fmt(t.dateISO)},${t.truckNumber||''},"${t.driverName||''}","${t.items.map(it=>`${it.name} ${it.qty}${it.unit}`).join(' | ')}",${plain(t.totalCost)}\n`;});
  dlCSV(csv,`stock_${from}_to_${to}.csv`);
});
document.getElementById('downloadSalaryBtn').addEventListener('click',()=>{
  const{salaries,from,to}=lastReport;if(!salaries.length){alert('சம்பள பதிவு இல்லை.');return;}
  let csv='தேதி,டிரக்,டிரைவர்,தொகை,குறிப்பு\n';
  salaries.forEach(s=>csv+=`${fmt(s.dateISO)},${s.truckNumber||''},${s.driverName||''},${plain(s.amount)},"${(s.notes||'').replace(/"/g,'""')}"\n`);
  dlCSV(csv,`salaries_${from}_to_${to}.csv`);
});

/* ============================================================
   SETTINGS TAB
   ============================================================ */
async function renderSettingsTab(){
  try{shop=await api('GET','/shop');}catch(e){showErr(e);return;}
  document.getElementById('setShopName').value   =shop.name||'';
  document.getElementById('setShopSub').value    =shop.sub||'';
  document.getElementById('setShopAddress').value=shop.address||'';
  document.getElementById('setShopPhone').value  =shop.phone||'';
  document.getElementById('setOwnerName').value  =shop.owner||'';
  document.getElementById('setNextBillNo').value =shop.nextBillNo||1;
}
document.getElementById('saveSettingsBtn').addEventListener('click', async()=>{
  const patch={
    name:document.getElementById('setShopName').value.trim()||shop.name,
    sub:document.getElementById('setShopSub').value.trim(),
    address:document.getElementById('setShopAddress').value.trim(),
    phone:document.getElementById('setShopPhone').value.trim(),
    owner:document.getElementById('setOwnerName').value.trim(),
    nextBillNo:parseInt(document.getElementById('setNextBillNo').value,10)||shop.nextBillNo
  };
  try{shop=await api('PUT','/shop',patch);}catch(e){showErr(e);return;}
  document.getElementById('brandShopName').textContent=shop.name;
  const c=document.getElementById('settingsSaved');c.classList.add('show');setTimeout(()=>c.classList.remove('show'),2200);
});
document.getElementById('exportDataBtn').addEventListener('click', async()=>{
  try{const d=await api('GET','/export');dlJSON(d,`veggie-backup_${todayISO()}.json`);}catch(e){showErr(e);}
});
document.getElementById('importDataInput').addEventListener('change', async(e)=>{
  const file=e.target.files[0];if(!file) return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!confirm('இப்போதைய தரவு மாற்றப்படும். தொடரவா?')) return;
      await api('POST','/import',data);
      alert('தரவு வெற்றிகரமாக மீட்டமைக்கப்பட்டது.');
      [shop,items,customers,trucks]=await Promise.all([api('GET','/shop'),api('GET','/items'),api('GET','/customers'),api('GET','/trucks')]);
      await renderDashboard();switchTab('dashboard');
    }catch(err){alert('பைலை படிக்க முடியவில்லை.');}
  };
  reader.readAsText(file);e.target.value='';
});

/* ============================================================
   THERMAL RECEIPT BUILDER
   Matches the exact format in the sample photo:
   shop header → bill meta → item table → totals
   ============================================================ */
function buildThermalBill(b){
  const itemRows=b.items.map(it=>`
    <tr>
      <td class="item-name">${esc(it.name)}</td>
      <td class="r">${it.qty}</td>
      <td class="r">${plain(it.price)}</td>
      <td class="r">${plain(it.value)}</td>
    </tr>`).join('');

  const vrRow=b.vehicleRent>0?`
    <div class="th-total-row">
      <span>வண்டி வாடகை</span><span class="r">${plain(b.vehicleRent)}</span>
    </div>`:'';

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
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="th-dash">
    <div class="th-totals">
      <div class="th-total-row bold">
        <span>மொத்த தொகை</span><span class="r">${plain(b.total)}</span>
      </div>
    </div>
    <hr class="th-dash">
    <div class="th-totals">
      <div class="th-total-row"><span>முன் பாக்கி</span><span class="r">${plain(b.prevBalance)}</span></div>
      ${vrRow}
      <div class="th-grand">
        <div class="th-total-row bold"><span>மொத்தம்</span><span class="r">${plain(b.grandTotal)}</span></div>
      </div>
    </div>
    <div class="th-foot">நன்றி! மீண்டும் வரவும்.</div>
  </div>`;
}

/* ============================================================
   SINGLE BILL PRINT MODAL
   ============================================================ */
const printModal=document.getElementById('printModal');

async function openPrintById(id){
  try{openPrintModal(await api('GET','/bills/'+id));}catch(e){showErr(e);}
}
function openPrintModal(bill){
  if(!bill) return;
  currentPrintBill=bill;
  // Use the same thermal template for the preview
  document.getElementById('billPrintArea').innerHTML=buildThermalBill(bill);
  printModal.classList.remove('hidden');
}
document.getElementById('closePrintBtn').addEventListener('click',()=>{
  printModal.classList.add('hidden');currentPrintBill=null;
});
document.getElementById('printBtn').addEventListener('click',()=>{
  // For single bill print: put it in thermalPrintArea so @media print picks it up correctly
  const area=document.getElementById('thermalPrintArea');
  area.innerHTML=buildThermalBill(currentPrintBill);
  printModal.classList.add('hidden');  // hide modal so it doesn't interfere
  window.print();
  setTimeout(()=>{area.innerHTML='';printModal.classList.add('hidden');},2000);
});

/* ---- WhatsApp ---- */
document.getElementById('whatsappBtn').addEventListener('click',()=>{
  if(!currentPrintBill) return;
  const b=currentPrintBill;
  let msg=`*${shop.name}*\n${shop.sub||''}\nCELL: ${shop.phone||''}\n\n`;
  msg+=`Bill No: ${b.billNo} | Date: ${fmt(b.dateISO)} | Time: ${b.timeDisplay||''}\n`;
  msg+=`To: ${b.customerName}\n`;
  msg+=`${'─'.repeat(32)}\n`;
  b.items.forEach(it=>msg+=`${it.name.padEnd(16)} ${String(it.qty).padStart(4)} × ${plain(it.price).padStart(7)} = ${plain(it.value).padStart(8)}\n`);
  msg+=`${'─'.repeat(32)}\n`;
  msg+=`*மொத்த தொகை : ₹${plain(b.total)}*\n`;
  msg+=`${'─'.repeat(32)}\n`;
  msg+=`முன் பாக்கி  : ₹${plain(b.prevBalance)}\n`;
  if(b.vehicleRent>0) msg+=`வண்டி வாடகை : ₹${plain(b.vehicleRent)}\n`;
  msg+=`*மொத்தம்     : ₹${plain(b.grandTotal)}*\n\n`;
  msg+=`நன்றி! — ${shop.name}`;
  const ph=(b.customerPhone||'').replace(/[^0-9]/g,'');
  window.open(ph?`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
});

/* ============================================================
   INIT
   ============================================================ */
(async()=>{
  try{
    [shop,items,customers,trucks]=await Promise.all([
      api('GET','/shop'),api('GET','/items'),api('GET','/customers'),api('GET','/trucks')
    ]);
    if(shop.name) document.getElementById('brandShopName').textContent=shop.name;
  }catch(e){console.error(e);}
  await renderDashboard();
})();
