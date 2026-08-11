/* ============================================================
   காய்கறி பில்லிங் — Vegetable Billing App
   All data is stored in the browser's localStorage.
   ============================================================ */

const STORAGE_KEYS = {
  shop: 'vb_shop',
  items: 'vb_items',
  customers: 'vb_customers',
  bills: 'vb_bills'
};

const DEFAULT_SHOP = {
  name: 'பெரிய அண்ணாச்சி',
  sub: 'மொத்த காய்கறி வியாபாரம்',
  address: 'டி.கே., மார்க்கெட், கோவை - 641 001.',
  phone: '95666 66662, 8524024075',
  owner: 'P. ஏசுவடியான்',
  nextBillNo: 1093
};

const DEFAULT_ITEMS = [
  ['சுரக்காய்', 'கிலோ', 28],
  ['பாவக்காய்', 'கிலோ', 14],
  ['தக்காளி', 'கிலோ', 30],
  ['வெங்காயம்', 'கிலோ', 35],
  ['உருளைக்கிழங்கு', 'கிலோ', 32],
  ['கேரட்', 'கிலோ', 40],
  ['பீன்ஸ்', 'கிலோ', 60],
  ['கத்தரிக்காய்', 'கிலோ', 25],
  ['வாழைக்காய்', 'கிலோ', 30],
  ['கோவைக்காய்', 'கிலோ', 35],
  ['பீர்க்கங்காய்', 'கிலோ', 25],
  ['முள்ளங்கி', 'கிலோ', 22],
  ['பூசணிக்காய்', 'கிலோ', 20],
  ['கேப்சிகம்', 'கிலோ', 45],
  ['காலிஃபிளவர்', 'கிலோ', 35],
  ['முட்டைகோஸ்', 'கிலோ', 25],
  ['வெள்ளரிக்காய்', 'கிலோ', 20],
  ['கொத்தவரங்காய்', 'கிலோ', 50],
  ['அவரைக்காய்', 'கிலோ', 40],
  ['பச்சை மிளகாய்', 'கிலோ', 50],
  ['கொத்தமல்லி', 'கட்டு', 5],
  ['கறிவேப்பிலை', 'கட்டு', 5],
  ['இஞ்சி', 'கிலோ', 80],
  ['பூண்டு', 'கிலோ', 90],
  ['கீரை', 'கட்டு', 10]
].map(([name, unit, price], i) => ({ id: 'it' + (i + 1), name, unit, price }));

/* ---------------- Generic storage helpers ---------------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------------- App state ---------------- */
let shop = load(STORAGE_KEYS.shop, DEFAULT_SHOP);
let items = load(STORAGE_KEYS.items, DEFAULT_ITEMS);
let customers = load(STORAGE_KEYS.customers, []);
let bills = load(STORAGE_KEYS.bills, []);

// First run seeding
if (load(STORAGE_KEYS.shop, null) === null) save(STORAGE_KEYS.shop, shop);
if (load(STORAGE_KEYS.items, null) === null) save(STORAGE_KEYS.items, items);
if (load(STORAGE_KEYS.customers, null) === null) save(STORAGE_KEYS.customers, customers);
if (load(STORAGE_KEYS.bills, null) === null) save(STORAGE_KEYS.bills, bills);

let billRowCounter = 0; // unique ids for bill item rows

/* ---------------- Utility ---------------- */
function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1000);
}
function money(n) {
  n = Number(n) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function plainMoney(n) {
  n = Number(n) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function pad(n) { return n.toString().padStart(2, '0'); }
function formatDateDisplay(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatTimeDisplay(date) {
  let h = date.getHours();
  const m = pad(date.getMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${pad(h)}:${m} ${ampm}`;
}
function findItem(id) { return items.find(it => it.id === id); }
function findCustomer(id) { return customers.find(c => c.id === id); }

/* ============================================================
   NAVIGATION
   ============================================================ */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'newbill') renderNewBillTab();
  if (tab === 'items') renderItemsTab();
  if (tab === 'customers') renderCustomersTab();
  if (tab === 'settings') renderSettingsTab();
}
document.getElementById('dashNewBillBtn').addEventListener('click', () => switchTab('newbill'));

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  document.getElementById('brandShopName').textContent = shop.name;
  const now = new Date();
  document.getElementById('todayDateDisplay').textContent =
    formatDateDisplay(todayISO()) + ' • ' + now.toLocaleDateString('ta-IN', { weekday: 'long' });

  const today = todayISO();
  const month = today.slice(0, 7); // YYYY-MM

  let todaySales = 0, todayCount = 0, monthSales = 0, monthCount = 0;
  bills.forEach(b => {
    if (b.dateISO === today) { todaySales += b.total; todayCount++; }
    if (b.dateISO.slice(0, 7) === month) { monthSales += b.total; monthCount++; }
  });

  document.getElementById('statTodaySales').textContent = money(todaySales);
  document.getElementById('statTodayBills').textContent = `${todayCount} பில்கள்`;
  document.getElementById('statMonthSales').textContent = money(monthSales);
  document.getElementById('statMonthBills').textContent = `${monthCount} பில்கள்`;

  const totalPending = customers.reduce((s, c) => s + (Number(c.balance) || 0), 0);
  document.getElementById('statPending').textContent = money(totalPending);
  document.getElementById('statCustomerCount').textContent = `${customers.length} வாடிக்கையாளர்`;
  document.getElementById('statItemCount').textContent = items.length;

  // Recent bills (latest 8)
  const tbody = document.querySelector('#recentBillsTable tbody');
  tbody.innerHTML = '';
  const recent = [...bills].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  document.getElementById('recentBillsEmpty').style.display = recent.length ? 'none' : 'block';
  recent.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.billNo}</td>
      <td>${formatDateDisplay(b.dateISO)}</td>
      <td>${escapeHtml(b.customerName)}</td>
      <td>${money(b.total)}</td>
      <td>${money(b.grandTotal)}</td>
      <td><button class="btn btn-ghost view-bill-btn" data-id="${b.id}">காண்க</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.view-bill-btn').forEach(btn => {
    btn.addEventListener('click', () => openPrintModal(bills.find(b => b.id === btn.dataset.id)));
  });
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ============================================================
   NEW BILL TAB
   ============================================================ */
function renderNewBillTab() {
  populateCustomerSelect();
  updatePrevBalanceDisplay();
  if (document.getElementById('billItemsBody').children.length === 0) {
    addBillRow();
  }
  recalcBillTotals();
}

function populateCustomerSelect() {
  const sel = document.getElementById('billCustomerSelect');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- தேர்வு செய்யவும் --</option>';
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name}${c.phone ? ' (' + c.phone + ')' : ''}`;
    sel.appendChild(opt);
  });
  if (customers.some(c => c.id === currentVal)) sel.value = currentVal;
}

document.getElementById('billCustomerSelect').addEventListener('change', updatePrevBalanceDisplay);

function updatePrevBalanceDisplay() {
  const custId = document.getElementById('billCustomerSelect').value;
  const cust = findCustomer(custId);
  const prev = cust ? (Number(cust.balance) || 0) : 0;
  document.querySelector('#prevBalanceLine strong').textContent = money(prev);
  document.getElementById('billPrevBalanceVal').textContent = money(prev);
  recalcBillTotals();
}

document.getElementById('addItemRowBtn').addEventListener('click', () => addBillRow());

function addBillRow() {
  const tbody = document.getElementById('billItemsBody');
  const rowId = 'row' + (++billRowCounter);
  const tr = document.createElement('tr');
  tr.dataset.rowId = rowId;

  const itemOptions = ['<option value="">-- பொருள் --</option>']
    .concat(items.map(it => `<option value="${it.id}">${escapeHtml(it.name)}</option>`))
    .join('');

  tr.innerHTML = `
    <td class="col-item"><select class="row-item-select">${itemOptions}</select></td>
    <td class="col-qty"><input type="number" class="row-qty" min="0" step="0.5" placeholder="0"></td>
    <td class="col-unit"><span class="row-unit muted">—</span></td>
    <td class="col-price"><input type="number" class="row-price" min="0" step="0.5" placeholder="0.00"></td>
    <td class="col-value"><span class="row-value">₹0.00</span></td>
    <td class="col-del"><button class="row-del-btn" title="நீக்கு">✕</button></td>
  `;
  tbody.appendChild(tr);

  const itemSelect = tr.querySelector('.row-item-select');
  const qtyInput = tr.querySelector('.row-qty');
  const priceInput = tr.querySelector('.row-price');
  const unitSpan = tr.querySelector('.row-unit');

  itemSelect.addEventListener('change', () => {
    const it = findItem(itemSelect.value);
    if (it) {
      unitSpan.textContent = it.unit;
      unitSpan.classList.remove('muted');
      priceInput.value = it.price;
    } else {
      unitSpan.textContent = '—';
      unitSpan.classList.add('muted');
      priceInput.value = '';
    }
    recalcRow(tr);
  });
  qtyInput.addEventListener('input', () => recalcRow(tr));
  priceInput.addEventListener('input', () => recalcRow(tr));
  tr.querySelector('.row-del-btn').addEventListener('click', () => {
    tr.remove();
    recalcBillTotals();
  });
}

function recalcRow(tr) {
  const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
  const price = parseFloat(tr.querySelector('.row-price').value) || 0;
  const value = qty * price;
  tr.querySelector('.row-value').textContent = money(value);
  recalcBillTotals();
}

function recalcBillTotals() {
  let total = 0;
  document.querySelectorAll('#billItemsBody tr').forEach(tr => {
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.row-price').value) || 0;
    total += qty * price;
  });
  const custId = document.getElementById('billCustomerSelect').value;
  const cust = findCustomer(custId);
  const prev = cust ? (Number(cust.balance) || 0) : 0;

  document.getElementById('billTodayTotal').textContent = money(total);
  document.getElementById('billPrevBalanceVal').textContent = money(prev);
  document.getElementById('billGrandTotal').textContent = money(total + prev);
}

document.getElementById('clearBillBtn').addEventListener('click', () => {
  if (!confirm('இந்த பில்லை அழிக்கவா?')) return;
  document.getElementById('billItemsBody').innerHTML = '';
  document.getElementById('billCustomerSelect').value = '';
  addBillRow();
  updatePrevBalanceDisplay();
});

document.getElementById('saveBillBtn').addEventListener('click', saveBill);

function saveBill() {
  const custId = document.getElementById('billCustomerSelect').value;
  const cust = findCustomer(custId);
  if (!cust) {
    alert('வாடிக்கையாளரை தேர்வு செய்யவும்.');
    return;
  }

  const rows = [];
  document.querySelectorAll('#billItemsBody tr').forEach(tr => {
    const itemId = tr.querySelector('.row-item-select').value;
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.row-price').value) || 0;
    if (!itemId || qty <= 0) return;
    const it = findItem(itemId);
    rows.push({
      name: it ? it.name : '—',
      unit: it ? it.unit : '',
      qty, price, value: qty * price
    });
  });

  if (rows.length === 0) {
    alert('குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்.');
    return;
  }

  const total = rows.reduce((s, r) => s + r.value, 0);
  const prevBalance = Number(cust.balance) || 0;
  const grandTotal = total + prevBalance;
  const now = new Date();

  const bill = {
    id: uid('bill_'),
    billNo: shop.nextBillNo,
    dateISO: todayISO(),
    timeDisplay: formatTimeDisplay(now),
    createdAt: now.getTime(),
    customerId: cust.id,
    customerName: cust.name,
    customerPhone: cust.phone || '',
    items: rows,
    total,
    prevBalance,
    grandTotal
  };

  bills.push(bill);
  save(STORAGE_KEYS.bills, bills);

  cust.balance = grandTotal;
  save(STORAGE_KEYS.customers, customers);

  shop.nextBillNo = shop.nextBillNo + 1;
  save(STORAGE_KEYS.shop, shop);

  // Reset form
  document.getElementById('billItemsBody').innerHTML = '';
  document.getElementById('billCustomerSelect').value = '';
  addBillRow();
  updatePrevBalanceDisplay();
  populateCustomerSelect();

  openPrintModal(bill);
}

/* ---------------- Quick Add Customer (modal) ---------------- */
const custModal = document.getElementById('custModal');
document.getElementById('newCustomerQuickBtn').addEventListener('click', () => {
  document.getElementById('qcName').value = '';
  document.getElementById('qcPhone').value = '';
  document.getElementById('qcBalance').value = 0;
  custModal.classList.remove('hidden');
  document.getElementById('qcName').focus();
});
document.getElementById('qcCancel').addEventListener('click', () => custModal.classList.add('hidden'));
document.getElementById('qcSave').addEventListener('click', () => {
  const name = document.getElementById('qcName').value.trim();
  if (!name) { alert('பெயரை குறிப்பிடவும்.'); return; }
  const phone = document.getElementById('qcPhone').value.trim();
  const balance = parseFloat(document.getElementById('qcBalance').value) || 0;
  const cust = { id: uid('cust_'), name, phone, balance };
  customers.push(cust);
  save(STORAGE_KEYS.customers, customers);
  custModal.classList.add('hidden');
  populateCustomerSelect();
  document.getElementById('billCustomerSelect').value = cust.id;
  updatePrevBalanceDisplay();
});

/* ============================================================
   ITEMS TAB
   ============================================================ */
function renderItemsTab() {
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = '';
  document.getElementById('itemsCountLabel').textContent = `${items.length} பொருட்கள்`;
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'ta')).forEach(it => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(it.name)}</td>
      <td>
        <select class="item-unit-select" data-id="${it.id}">
          ${['கிலோ', 'எண்ணிக்கை', 'கட்டு', 'மூட்டை'].map(u =>
            `<option value="${u}" ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </td>
      <td><input type="number" class="item-price-input" data-id="${it.id}" value="${it.price}" min="0" step="0.5"></td>
      <td><button class="btn-danger-text item-del-btn" data-id="${it.id}">நீக்கு</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.item-unit-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const it = findItem(sel.dataset.id);
      it.unit = sel.value;
      save(STORAGE_KEYS.items, items);
    });
  });
  tbody.querySelectorAll('.item-price-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const it = findItem(inp.dataset.id);
      it.price = parseFloat(inp.value) || 0;
      save(STORAGE_KEYS.items, items);
    });
  });
  tbody.querySelectorAll('.item-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('இந்த பொருளை நீக்கவா?')) return;
      items = items.filter(it => it.id !== btn.dataset.id);
      save(STORAGE_KEYS.items, items);
      renderItemsTab();
    });
  });
}

document.getElementById('addItemBtn').addEventListener('click', () => {
  const name = document.getElementById('newItemName').value.trim();
  const unit = document.getElementById('newItemUnit').value;
  const price = parseFloat(document.getElementById('newItemPrice').value) || 0;
  if (!name) { alert('பொருளின் பெயரை குறிப்பிடவும்.'); return; }
  items.push({ id: uid('it_'), name, unit, price });
  save(STORAGE_KEYS.items, items);
  document.getElementById('newItemName').value = '';
  document.getElementById('newItemPrice').value = '';
  renderItemsTab();
});

/* ============================================================
   CUSTOMERS TAB
   ============================================================ */
function renderCustomersTab() {
  const tbody = document.querySelector('#customersTable tbody');
  tbody.innerHTML = '';
  document.getElementById('custCountLabel').textContent = `${customers.length} வாடிக்கையாளர்`;
  [...customers].sort((a, b) => a.name.localeCompare(b.name, 'ta')).forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td><input type="tel" class="cust-phone-input" data-id="${c.id}" value="${escapeHtml(c.phone || '')}" placeholder="91XXXXXXXXXX"></td>
      <td><input type="number" class="cust-balance-input" data-id="${c.id}" value="${c.balance}" step="1"></td>
      <td><button class="btn-danger-text cust-del-btn" data-id="${c.id}">நீக்கு</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.cust-phone-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const c = findCustomer(inp.dataset.id);
      c.phone = inp.value.trim();
      save(STORAGE_KEYS.customers, customers);
    });
  });
  tbody.querySelectorAll('.cust-balance-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const c = findCustomer(inp.dataset.id);
      c.balance = parseFloat(inp.value) || 0;
      save(STORAGE_KEYS.customers, customers);
    });
  });
  tbody.querySelectorAll('.cust-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = findCustomer(btn.dataset.id);
      if (!confirm(`"${c.name}" -ஐ நீக்கவா? இவருடைய பழைய பில்கள் அறிக்கையில் இருக்கும்.`)) return;
      customers = customers.filter(x => x.id !== btn.dataset.id);
      save(STORAGE_KEYS.customers, customers);
      renderCustomersTab();
    });
  });
}

document.getElementById('addCustBtn').addEventListener('click', () => {
  const name = document.getElementById('newCustName').value.trim();
  const phone = document.getElementById('newCustPhone').value.trim();
  const balance = parseFloat(document.getElementById('newCustOpeningBalance').value) || 0;
  if (!name) { alert('பெயரை குறிப்பிடவும்.'); return; }
  customers.push({ id: uid('cust_'), name, phone, balance });
  save(STORAGE_KEYS.customers, customers);
  document.getElementById('newCustName').value = '';
  document.getElementById('newCustPhone').value = '';
  document.getElementById('newCustOpeningBalance').value = '';
  renderCustomersTab();
});

/* ============================================================
   REPORTS TAB
   ============================================================ */
let lastReportRows = [];

(function initReportDates() {
  const to = todayISO();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.getFullYear() + '-' + pad(fromDate.getMonth() + 1) + '-' + pad(fromDate.getDate());
  document.getElementById('reportFrom').value = from;
  document.getElementById('reportTo').value = to;
})();

document.getElementById('runReportBtn').addEventListener('click', runReport);

function runReport() {
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  if (!from || !to) { alert('தேதி வரம்பை தேர்வு செய்யவும்.'); return; }

  const filtered = bills.filter(b => b.dateISO >= from && b.dateISO <= to)
    .sort((a, b) => a.createdAt - b.createdAt);
  lastReportRows = filtered;

  const tbody = document.querySelector('#reportTable tbody');
  tbody.innerHTML = '';
  document.getElementById('reportEmpty').style.display = filtered.length ? 'none' : 'block';

  let totalSales = 0;
  filtered.forEach(b => {
    totalSales += b.total;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.billNo}</td>
      <td>${formatDateDisplay(b.dateISO)}</td>
      <td>${b.timeDisplay}</td>
      <td>${escapeHtml(b.customerName)}</td>
      <td>${money(b.total)}</td>
      <td>${money(b.grandTotal)}</td>
      <td><button class="btn btn-ghost view-bill-btn" data-id="${b.id}">காண்க</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.view-bill-btn').forEach(btn => {
    btn.addEventListener('click', () => openPrintModal(bills.find(b => b.id === btn.dataset.id)));
  });

  document.getElementById('reportStats').style.display = 'grid';
  document.getElementById('reportBillCount').textContent = filtered.length;
  document.getElementById('reportTotalSales').textContent = money(totalSales);
  document.getElementById('reportAvgBill').textContent = money(filtered.length ? totalSales / filtered.length : 0);
}

document.getElementById('downloadReportBtn').addEventListener('click', () => {
  if (lastReportRows.length === 0) {
    if (!confirm('அறிக்கையில் பில் எதுவும் இல்லை. இப்போதே உருவாக்கவா?')) return;
    runReport();
    if (lastReportRows.length === 0) return;
  }
  let csv = 'பில் எண்,தேதி,நேரம்,வாடிக்கையாளர்,பொருட்கள்,இன்றைய தொகை,முன் பாக்கி,மொத்தம்\n';
  lastReportRows.forEach(b => {
    const itemsStr = b.items.map(it => `${it.name} (${it.qty} ${it.unit} x ${it.price})`).join(' | ');
    csv += [
      b.billNo,
      formatDateDisplay(b.dateISO),
      b.timeDisplay,
      `"${b.customerName.replace(/"/g, '""')}"`,
      `"${itemsStr.replace(/"/g, '""')}"`,
      plainMoney(b.total),
      plainMoney(b.prevBalance),
      plainMoney(b.grandTotal)
    ].join(',') + '\n';
  });
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  downloadBlob(csv, `sales-report_${from}_to_${to}.csv`, 'text/csv;charset=utf-8;');
});

function downloadBlob(content, filename, mime) {
  const blob = new Blob(['\uFEFF' + content], { type: mime }); // BOM for Excel Tamil support
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   SETTINGS TAB
   ============================================================ */
function renderSettingsTab() {
  document.getElementById('setShopName').value = shop.name;
  document.getElementById('setShopSub').value = shop.sub;
  document.getElementById('setShopAddress').value = shop.address;
  document.getElementById('setShopPhone').value = shop.phone;
  document.getElementById('setOwnerName').value = shop.owner;
  document.getElementById('setNextBillNo').value = shop.nextBillNo;
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  shop.name = document.getElementById('setShopName').value.trim() || shop.name;
  shop.sub = document.getElementById('setShopSub').value.trim();
  shop.address = document.getElementById('setShopAddress').value.trim();
  shop.phone = document.getElementById('setShopPhone').value.trim();
  shop.owner = document.getElementById('setOwnerName').value.trim();
  shop.nextBillNo = parseInt(document.getElementById('setNextBillNo').value, 10) || shop.nextBillNo;
  save(STORAGE_KEYS.shop, shop);
  document.getElementById('brandShopName').textContent = shop.name;
  const conf = document.getElementById('settingsSaved');
  conf.classList.add('show');
  setTimeout(() => conf.classList.remove('show'), 2000);
});

/* ---------------- Backup / Restore ---------------- */
document.getElementById('exportDataBtn').addEventListener('click', () => {
  const data = {
    shop, items, customers, bills,
    exportedAt: new Date().toISOString()
  };
  downloadBlob(JSON.stringify(data, null, 2), `veggie-billing-backup_${todayISO()}.json`, 'application/json');
});

document.getElementById('importDataInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('இப்போதைய தரவு மாற்றப்பட்டு, இந்த பைலில் இருக்கும் தரவு ஏற்றப்படும். தொடரவா?')) return;
      if (data.shop) { shop = data.shop; save(STORAGE_KEYS.shop, shop); }
      if (data.items) { items = data.items; save(STORAGE_KEYS.items, items); }
      if (data.customers) { customers = data.customers; save(STORAGE_KEYS.customers, customers); }
      if (data.bills) { bills = data.bills; save(STORAGE_KEYS.bills, bills); }
      alert('தரவு வெற்றிகரமாக மீட்டமைக்கப்பட்டது.');
      renderDashboard();
      switchTab('dashboard');
    } catch (err) {
      alert('இந்த பைலை படிக்க முடியவில்லை. சரியான backup JSON பைலை தேர்வு செய்யவும்.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ============================================================
   PRINT / RECEIPT MODAL
   ============================================================ */
const printModal = document.getElementById('printModal');
let currentPrintBill = null;

function openPrintModal(bill) {
  if (!bill) return;
  currentPrintBill = bill;
  document.getElementById('billPrintArea').innerHTML = buildReceiptHTML(bill);
  printModal.classList.remove('hidden');
}
document.getElementById('closePrintBtn').addEventListener('click', () => {
  printModal.classList.add('hidden');
  currentPrintBill = null;
});
document.getElementById('printBtn').addEventListener('click', () => window.print());

function buildReceiptHTML(b) {
  const itemRows = b.items.map(it => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td class="num">${it.qty}</td>
      <td class="num">${plainMoney(it.price)}</td>
      <td class="num">${plainMoney(it.value)}</td>
    </tr>
  `).join('');

  return `
    <div class="receipt-center">
      <div class="receipt-shop-name">${escapeHtml(shop.name)}</div>
      <div class="receipt-shop-sub">${escapeHtml(shop.sub)}</div>
      <div>${escapeHtml(shop.address)}</div>
      <div>CELL: ${escapeHtml(shop.phone)}</div>
      <div>உரிமை : ${escapeHtml(shop.owner)}</div>
    </div>
    <div class="receipt-meta" style="margin-top:8px;">
      <span>Bill No. : ${b.billNo}</span>
      <span>Date : ${formatDateDisplay(b.dateISO)}</span>
    </div>
    <div class="receipt-meta">
      <span>To : ${escapeHtml(b.customerName)}</span>
      <span>Time : ${b.timeDisplay}</span>
    </div>
    <div class="receipt-line"></div>
    <table class="receipt-table">
      <thead>
        <tr><th>பொருள்</th><th class="num">அளவு</th><th class="num">விலை</th><th class="num">மதிப்பு</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="receipt-line"></div>
    <div class="receipt-totals">
      <div class="totals-row grand">
        <span>மொத்த தொகை</span><strong>${plainMoney(b.total)}</strong>
      </div>
    </div>
    <div class="receipt-line"></div>
    <div class="receipt-totals">
      <div class="totals-row"><span>முன் பாக்கி</span><strong>${plainMoney(b.prevBalance)}</strong></div>
      <div class="totals-row"><span>இன்றைய தொகை</span><strong>${plainMoney(b.total)}</strong></div>
      <div class="totals-row grand"><span>மொத்தம்</span><strong>${plainMoney(b.grandTotal)}</strong></div>
    </div>
    <div class="receipt-foot">நன்றி! மீண்டும் வரவும்.</div>
  `;
}

/* ---------------- WhatsApp share ---------------- */
document.getElementById('whatsappBtn').addEventListener('click', () => {
  if (!currentPrintBill) return;
  const b = currentPrintBill;
  let msg = `*${shop.name}*\n${shop.sub}\n${shop.address}\n\n`;
  msg += `பில் எண்: ${b.billNo}\nதேதி: ${formatDateDisplay(b.dateISO)}   நேரம்: ${b.timeDisplay}\nகடை: ${b.customerName}\n\n`;
  b.items.forEach(it => {
    msg += `${it.name} - ${it.qty} ${it.unit} x ₹${plainMoney(it.price)} = ₹${plainMoney(it.value)}\n`;
  });
  msg += `\nஇன்றைய தொகை: ₹${plainMoney(b.total)}\n`;
  msg += `முன் பாக்கி: ₹${plainMoney(b.prevBalance)}\n`;
  msg += `*மொத்தம்: ₹${plainMoney(b.grandTotal)}*\n\n`;
  msg += `நன்றி! - ${shop.name}`;

  const phone = (b.customerPhone || '').replace(/[^0-9]/g, '');
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
});

/* ============================================================
   INIT
   ============================================================ */
renderDashboard();
renderNewBillTab();
