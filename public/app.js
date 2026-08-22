/* ============================================================
   SRI K.M. VEGETABLES — Billing App
   Data lives in Supabase (see db.js). This file keeps the exact
   same in-memory arrays/render logic as the earlier localStorage
   version — only the load/save points now go through DB.* calls.
   ============================================================ */

const DEFAULT_SHOP = {
  tagline: 'ஸ்ரீ மீன்குளத்தி பகவதி அம்மன் துணை',
  name: 'SRI',
  nameMid: 'K.M.',
  nameBottom: 'VEGETABLES',
  sub: 'Wholesale Suppliers',
  address: '29/434 U.M.C. Market, Ooty.',
  phone: '94434 06210, 91590 72255',
  nextBillNo: 1001
};

/* ---------------- App state ----------------
   Populated by boot() -> DB.fetchAll() once the shop PIN is verified.
   Stays empty/blank until then; the login gate covers the screen
   so no tab can be interacted with before this is filled in. */
let shop = { ...DEFAULT_SHOP };
let items = [];
let customers = [];
let bills = [];
let payments = [];

/* ---------------- Balance engine ----------------
   Every customer has an `openingBalance` (set once, e.g. when they are
   first added, or when migrating old paper accounts).
   Their balance on any date = openingBalance
                                + sum of all bill totals dated <= that date
                                - sum of all payments dated <= that date
   This mirrors the paper ledger exactly: முதல் பாக்கி + பொருள் எடுக்கது
   - ரூ. கொடுத்தது = பாக்கி, and lets us reconstruct any past day's row
   without storing a separate snapshot per day. */
function customerBillsOn(custId, dateISO) {
  return bills.filter(b => b.customerId === custId && b.dateISO === dateISO);
}
function customerPaymentsOn(custId, dateISO) {
  return payments.filter(p => p.customerId === custId && p.dateISO === dateISO);
}
function sumBillsUpto(custId, dateISO, inclusive) {
  return bills
    .filter(b => b.customerId === custId && (inclusive ? b.dateISO <= dateISO : b.dateISO < dateISO))
    .reduce((s, b) => s + b.total, 0);
}
function sumPaymentsUpto(custId, dateISO, inclusive) {
  return payments
    .filter(p => p.customerId === custId && (inclusive ? p.dateISO <= dateISO : p.dateISO < dateISO))
    .reduce((s, p) => s + p.amount, 0);
}
// Balance as of end of given date (default: today) — this is what should be
// shown everywhere as "current பாக்கி".
function customerBalanceAsOf(cust, dateISO) {
  const opening = Number(cust.openingBalance) || 0;
  return opening + sumBillsUpto(cust.id, dateISO, true) - sumPaymentsUpto(cust.id, dateISO, true);
}
function customerCurrentBalance(cust) {
  return customerBalanceAsOf(cust, todayISO());
}
// Opening balance for a *specific day's ledger row* = balance just before
// that day's transactions.
function customerOpeningForDate(cust, dateISO) {
  const opening = Number(cust.openingBalance) || 0;
  return opening + sumBillsUpto(cust.id, dateISO, false) - sumPaymentsUpto(cust.id, dateISO, false);
}

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
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
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
function shopFullName() {
  return [shop.name, shop.nameMid, shop.nameBottom].filter(Boolean).join(' ');
}

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
  if (tab === 'ledger') renderLedgerTab();
  if (tab === 'monthly') renderMonthlyTab();
  if (tab === 'items') renderItemsTab();
  if (tab === 'customers') renderCustomersTab();
  if (tab === 'settings') renderSettingsTab();
}
document.getElementById('dashNewBillBtn').addEventListener('click', () => switchTab('newbill'));

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  document.getElementById('brandShopName').textContent = shopFullName();
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

  const totalPending = customers.reduce((s, c) => s + customerCurrentBalance(c), 0);
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
      <td>
        <button class="btn btn-ghost view-bill-btn" data-id="${b.id}">காண்க</button>
        <button class="btn btn-ghost btn-danger-text bill-del-btn" data-id="${b.id}" title="பில் நீக்கு">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.view-bill-btn').forEach(btn => {
    btn.addEventListener('click', () => openPrintModal(bills.find(b => b.id === btn.dataset.id)));
  });
  tbody.querySelectorAll('.bill-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteBillById(btn.dataset.id, btn));
  });
}
/* ---------------- Delete a bill (made by mistake) ----------------
   Bills are shown in the Dashboard's recent list and the Reports
   tab; both share this one function. Deleting just removes the row
   — since every balance is derived (opening + bills − payments),
   the customer's balance corrects itself automatically, no other
   bookkeeping needed. Bill numbers are not reused/renumbered after
   a delete (normal accounting practice — a gap is fine, a duplicate
   number is not). */
async function deleteBillById(id, btn) {
  const b = bills.find(x => x.id === id);
  if (!b) return;
  const ok = confirm(
    `பில் எண் ${b.billNo} (${b.customerName}, ₹${plainMoney(b.total)}) ஐ நீக்கவா?\n` +
    `இது நிரந்தரமாக நீக்கப்படும், "${b.customerName}"-ன் பாக்கி தொகையும் அதற்கேற்ப மாறும்.`
  );
  if (!ok) return;
  if (btn) btn.disabled = true;
  try {
    await DB.deleteBill(id);
    bills = bills.filter(x => x.id !== id);
    renderDashboard();
    if (document.getElementById('tab-reports').classList.contains('active')) runReport();
    if (document.getElementById('tab-ledger').classList.contains('active')) renderLedgerTab();
    if (document.getElementById('tab-customers').classList.contains('active')) renderCustomersTab();
  } catch (err) {
    alert('பில்லை நீக்க முடியவில்லை — இணையம் இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.');
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
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
  const prev = cust ? customerCurrentBalance(cust) : 0;
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
  const prev = cust ? customerCurrentBalance(cust) : 0;

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

async function saveBill() {
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
  const prevBalance = customerCurrentBalance(cust);
  const grandTotal = total + prevBalance;
  const now = new Date();
  const dateISO = todayISO();
  // Any payment already recorded for this customer earlier today (e.g. cash
  // handed over along with picking up the goods) — captured as a snapshot
  // on the bill itself, the way a printed paper receipt would show it at
  // that moment. Payments recorded later the same day won't retroactively
  // change a bill that's already been printed/shared.
  const paidToday = customerPaymentsOn(cust.id, dateISO).reduce((s, p) => s + p.amount, 0);

  const bill = {
    id: uid('bill_'),
    billNo: shop.nextBillNo,
    dateISO,
    timeDisplay: formatTimeDisplay(now),
    createdAt: now.getTime(),
    customerId: cust.id,
    customerName: cust.name,
    customerPhone: cust.phone || '',
    items: rows,
    total,
    prevBalance,
    grandTotal,
    paidToday
  };

  const saveBtn = document.getElementById('saveBillBtn');
  saveBtn.disabled = true;
  try {
    await DB.insertBill(bill);
    bills.push(bill);

    shop.nextBillNo = shop.nextBillNo + 1;
    await DB.saveShop(shop);

    // Reset form
    document.getElementById('billItemsBody').innerHTML = '';
    document.getElementById('billCustomerSelect').value = '';
    addBillRow();
    updatePrevBalanceDisplay();
    populateCustomerSelect();

    openPrintModal(bill);
  } catch (err) {
    alert('பில்லை சேமிக்க முடியவில்லை — இணையம் இணைப்பை சரிபார்க்கவும்.');
    console.error(err);
  } finally {
    saveBtn.disabled = false;
  }
}

/* ---------------- Quick Add Customer (modal) ---------------- */
const custModal = document.getElementById('custModal');
document.getElementById('newCustomerQuickBtn').addEventListener('click', () => {
  document.getElementById('qcName').value = '';
  document.getElementById('qcPhone').value = '';
  document.getElementById('qcBalance').value = 0;
  openModal(custModal);
  document.getElementById('qcName').focus();
});
document.getElementById('qcCancel').addEventListener('click', () => closeModal(custModal));
document.getElementById('qcSave').addEventListener('click', async () => {
  const name = document.getElementById('qcName').value.trim();
  if (!name) { alert('பெயரை குறிப்பிடவும்.'); return; }
  const phone = document.getElementById('qcPhone').value.trim();
  const openingBalance = parseFloat(document.getElementById('qcBalance').value) || 0;
  const cust = { id: uid('cust_'), name, phone, openingBalance };
  const btn = document.getElementById('qcSave');
  btn.disabled = true;
  try {
    await DB.upsertCustomer(cust);
    customers.push(cust);
    closeModal(custModal);
    populateCustomerSelect();
    document.getElementById('billCustomerSelect').value = cust.id;
    updatePrevBalanceDisplay();
  } catch (err) {
    alert('வாடிக்கையாளரை சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

/* ============================================================
   ITEMS TAB
   ============================================================ */
function renderItemsTab() {
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = '';
  const term = (document.getElementById('itemSearchInput').value || '').trim().toLowerCase();
  const filtered = term ? items.filter(it => it.name.toLowerCase().includes(term)) : items;

  document.getElementById('itemsCountLabel').textContent = term
    ? `${filtered.length} / ${items.length} பொருட்கள்`
    : `${items.length} பொருட்கள்`;
  document.getElementById('itemSearchEmpty').style.display = (term && filtered.length === 0) ? 'block' : 'none';
  document.getElementById('itemSearchEmptyTerm').textContent = document.getElementById('itemSearchInput').value.trim();

  [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ta')).forEach(it => {
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
    sel.addEventListener('change', async () => {
      const it = findItem(sel.dataset.id);
      it.unit = sel.value;
      try { await DB.upsertItem(it); } catch (err) { alert('சேமிக்க முடியவில்லை.'); console.error(err); }
    });
  });
  tbody.querySelectorAll('.item-price-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const it = findItem(inp.dataset.id);
      it.price = parseFloat(inp.value) || 0;
      try { await DB.upsertItem(it); } catch (err) { alert('சேமிக்க முடியவில்லை.'); console.error(err); }
    });
  });
  tbody.querySelectorAll('.item-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('இந்த பொருளை நீக்கவா?')) return;
      const id = btn.dataset.id;
      try {
        await DB.deleteItem(id);
        items = items.filter(it => it.id !== id);
        renderItemsTab();
      } catch (err) {
        alert('நீக்க முடியவில்லை.'); console.error(err);
      }
    });
  });
}
document.getElementById('itemSearchInput').addEventListener('input', renderItemsTab);

document.getElementById('addItemBtn').addEventListener('click', async () => {
  const name = document.getElementById('newItemName').value.trim();
  const unit = document.getElementById('newItemUnit').value;
  const price = parseFloat(document.getElementById('newItemPrice').value) || 0;
  if (!name) { alert('பொருளின் பெயரை குறிப்பிடவும்.'); return; }
  const it = { id: uid('it_'), name, unit, price };
  try {
    await DB.upsertItem(it);
    items.push(it);
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemPrice').value = '';
    renderItemsTab();
  } catch (err) {
    alert('பொருளை சேமிக்க முடியவில்லை.'); console.error(err);
  }
});

/* ============================================================
   CUSTOMERS TAB
   ============================================================ */
function renderCustomersTab() {
  const tbody = document.querySelector('#customersTable tbody');
  tbody.innerHTML = '';
  const term = (document.getElementById('custSearchInput').value || '').trim().toLowerCase();
  const filtered = term
    ? customers.filter(c => c.name.toLowerCase().includes(term) || (c.phone || '').includes(term))
    : customers;

  document.getElementById('custCountLabel').textContent = term
    ? `${filtered.length} / ${customers.length} வாடிக்கையாளர்`
    : `${customers.length} வாடிக்கையாளர்`;
  document.getElementById('custSearchEmpty').style.display = (term && filtered.length === 0) ? 'block' : 'none';
  document.getElementById('custSearchEmptyTerm').textContent = document.getElementById('custSearchInput').value.trim();

  [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ta')).forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td><input type="tel" class="cust-phone-input" data-id="${c.id}" value="${escapeHtml(c.phone || '')}" placeholder="91XXXXXXXXXX"></td>
      <td><input type="number" class="cust-balance-input" data-id="${c.id}" value="${Number(c.openingBalance) || 0}" step="1" title="இது ஆரம்ப பாக்கி மட்டும். தற்போதைய பாக்கியை மாற்ற பணம் பெற்றது / புதிய பில் பயன்படுத்தவும்."></td>
      <td class="num strong">${money(customerCurrentBalance(c))}</td>
      <td><button class="btn btn-ghost cust-pay-btn" data-id="${c.id}">💰 பணம் பெற்றது</button></td>
      <td><button class="btn-danger-text cust-del-btn" data-id="${c.id}">நீக்கு</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.cust-phone-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const c = findCustomer(inp.dataset.id);
      c.phone = inp.value.trim();
      try { await DB.upsertCustomer(c); } catch (err) { alert('சேமிக்க முடியவில்லை.'); console.error(err); }
    });
  });
  tbody.querySelectorAll('.cust-balance-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const c = findCustomer(inp.dataset.id);
      c.openingBalance = parseFloat(inp.value) || 0;
      try {
        await DB.upsertCustomer(c);
        renderCustomersTab();
      } catch (err) { alert('சேமிக்க முடியவில்லை.'); console.error(err); }
    });
  });
  tbody.querySelectorAll('.cust-pay-btn').forEach(btn => {
    btn.addEventListener('click', () => openPaymentModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.cust-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = findCustomer(btn.dataset.id);
      if (!confirm(`"${c.name}" -ஐ நீக்கவா? இவருடைய பழைய பில்கள் அறிக்கையில் இருக்கும்.`)) return;
      try {
        await DB.deleteCustomer(c.id);
        customers = customers.filter(x => x.id !== c.id);
        renderCustomersTab();
      } catch (err) { alert('நீக்க முடியவில்லை.'); console.error(err); }
    });
  });
}
document.getElementById('custSearchInput').addEventListener('input', renderCustomersTab);

document.getElementById('addCustBtn').addEventListener('click', async () => {
  const name = document.getElementById('newCustName').value.trim();
  const phone = document.getElementById('newCustPhone').value.trim();
  const openingBalance = parseFloat(document.getElementById('newCustOpeningBalance').value) || 0;
  if (!name) { alert('பெயரை குறிப்பிடவும்.'); return; }
  const c = { id: uid('cust_'), name, phone, openingBalance };
  try {
    await DB.upsertCustomer(c);
    customers.push(c);
    document.getElementById('newCustName').value = '';
    document.getElementById('newCustPhone').value = '';
    document.getElementById('newCustOpeningBalance').value = '';
    renderCustomersTab();
  } catch (err) {
    alert('வாடிக்கையாளரை சேமிக்க முடியவில்லை.'); console.error(err);
  }
});

/* ============================================================
   PAYMENTS ("ரூ. கொடுத்தது" — money received from customer)
   ============================================================ */
const payModal = document.getElementById('payModal');
let payModalCustId = null;

function openPaymentModal(custId) {
  const c = findCustomer(custId);
  if (!c) return;
  payModalCustId = custId;
  document.getElementById('payCustName').textContent = c.name;
  document.getElementById('payCurrentBalance').textContent = money(customerCurrentBalance(c));
  document.getElementById('payDate').value = todayISO();
  document.getElementById('payAmount').value = '';
  document.getElementById('payNote').value = '';
  payModal.classList.remove('hidden');
  history.pushState({ skvModalOpen: true }, '');
  document.getElementById('payAmount').focus();
}
document.getElementById('payCancel').addEventListener('click', () => closeModal(payModal));
document.getElementById('paySave').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('payAmount').value) || 0;
  const dateISO = document.getElementById('payDate').value || todayISO();
  const note = document.getElementById('payNote').value.trim();
  if (!payModalCustId) return;
  if (amount <= 0) { alert('சரியான தொகையை குறிப்பிடவும்.'); return; }
  const payment = {
    id: uid('pay_'),
    customerId: payModalCustId,
    dateISO,
    amount,
    note,
    createdAt: Date.now()
  };
  const btn = document.getElementById('paySave');
  btn.disabled = true;
  try {
    await DB.insertPayment(payment);
    payments.push(payment);
    closeModal(payModal);
    renderCustomersTab();
    renderDashboard();
    if (document.getElementById('tab-ledger').classList.contains('active')) renderLedgerTab();
  } catch (err) {
    alert('பணம் பெற்றதை சேமிக்க முடியவில்லை.'); console.error(err);
  } finally {
    btn.disabled = false;
  }
});

/* ============================================================
   DAILY LEDGER — mirrors the paper accounts sheet:
   பெயர் | முதல் பாக்கி | பொருள் எடுக்கது | மொத்தம் | ரூ. கொடுத்தது | பாக்கி
   ============================================================ */
(function initLedgerDate() {
  document.getElementById('ledgerDate').value = todayISO();
})();
document.getElementById('ledgerDate').addEventListener('change', renderLedgerTab);
document.getElementById('ledgerTodayBtn').addEventListener('click', () => {
  document.getElementById('ledgerDate').value = todayISO();
  renderLedgerTab();
});

function renderLedgerTab() {
  const dateISO = document.getElementById('ledgerDate').value || todayISO();
  document.getElementById('ledgerDateLabel').textContent = formatDateDisplay(dateISO);

  const tbody = document.querySelector('#ledgerTable tbody');
  tbody.innerHTML = '';

  let sumOpening = 0, sumGoods = 0, sumPaid = 0, sumClosing = 0;
  const rows = [...customers].sort((a, b) => a.name.localeCompare(b.name, 'ta'));

  document.getElementById('ledgerEmpty').style.display = rows.length ? 'none' : 'block';

  rows.forEach(c => {
    const opening = customerOpeningForDate(c, dateISO);
    const goodsToday = customerBillsOn(c.id, dateISO).reduce((s, b) => s + b.total, 0);
    const paidToday = customerPaymentsOn(c.id, dateISO).reduce((s, p) => s + p.amount, 0);
    const total = opening + goodsToday;
    const closing = total - paidToday;

    sumOpening += opening; sumGoods += goodsToday; sumPaid += paidToday; sumClosing += closing;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td class="num">${plainMoney(opening)}</td>
      <td class="num">${goodsToday ? plainMoney(goodsToday) : '—'}</td>
      <td class="num strong">${plainMoney(total)}</td>
      <td class="num">${paidToday ? plainMoney(paidToday) : '—'}</td>
      <td class="num strong">${plainMoney(closing)}</td>
      <td>
        <button class="btn btn-ghost ledger-bill-btn" data-id="${c.id}" title="இன்று இந்த வாடிக்கையாளருக்கு பில் போட">🧾</button>
        <button class="btn btn-ghost ledger-pay-btn" data-id="${c.id}" title="பணம் பெற்றது சேர்">💰</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('ledgerSumOpening').textContent = plainMoney(sumOpening);
  document.getElementById('ledgerSumGoods').textContent = plainMoney(sumGoods);
  document.getElementById('ledgerSumTotal').textContent = plainMoney(sumOpening + sumGoods);
  document.getElementById('ledgerSumPaid').textContent = plainMoney(sumPaid);
  document.getElementById('ledgerSumClosing').textContent = plainMoney(sumClosing);

  tbody.querySelectorAll('.ledger-pay-btn').forEach(btn => {
    btn.addEventListener('click', () => openPaymentModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.ledger-bill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab('newbill');
      document.getElementById('billCustomerSelect').value = btn.dataset.id;
      updatePrevBalanceDisplay();
    });
  });

  renderPaidTodayList(dateISO);
}

/* ---------------- Paid Today list ----------------
   A flat list of every individual payment recorded on the selected
   date (not aggregated per customer, since he wants to be able to
   spot and delete one wrong entry without affecting the others). */
function renderPaidTodayList(dateISO) {
  document.getElementById('paidTodayDateLabel').textContent = formatDateDisplay(dateISO);
  const todaysPayments = payments
    .filter(p => p.dateISO === dateISO)
    .sort((a, b) => a.createdAt - b.createdAt);

  document.getElementById('paidTodayCountLabel').textContent = `${todaysPayments.length} பேர்`;
  document.getElementById('paidTodayEmpty').style.display = todaysPayments.length ? 'none' : 'block';

  const tbody = document.querySelector('#paidTodayTable tbody');
  tbody.innerHTML = '';
  let sum = 0;
  todaysPayments.forEach(p => {
    sum += p.amount;
    const c = findCustomer(p.customerId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(c ? c.name : 'வாடிக்கையாளர் நீக்கப்பட்டது')}</td>
      <td class="num strong">${plainMoney(p.amount)}</td>
      <td>${escapeHtml(p.note || '—')}</td>
      <td>${formatTimeDisplay(new Date(p.createdAt))}</td>
      <td><button class="btn-danger-text pay-del-btn" data-id="${p.id}">🗑 நீக்கு</button></td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('paidTodaySum').textContent = plainMoney(sum);

  tbody.querySelectorAll('.pay-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deletePaymentById(btn.dataset.id, btn));
  });
}

/* ---------------- Delete a payment (recorded by mistake) ----------------
   Same reasoning as deleteBillById: balances are always derived, so
   removing a payment row is enough — every customer's balance
   corrects itself with no other bookkeeping. */
async function deletePaymentById(id, btn) {
  const p = payments.find(x => x.id === id);
  if (!p) return;
  const c = findCustomer(p.customerId);
  const ok = confirm(
    `${c ? c.name : 'இந்த'} -இடமிருந்து பெற்ற ₹${plainMoney(p.amount)} பணம் பெற்ற பதிவை நீக்கவா?\n` +
    `இது நிரந்தரமாக நீக்கப்படும், பாக்கி தொகையும் அதற்கேற்ப மாறும்.`
  );
  if (!ok) return;
  if (btn) btn.disabled = true;
  try {
    await DB.deletePayment(id);
    payments = payments.filter(x => x.id !== id);
    if (document.getElementById('tab-ledger').classList.contains('active')) renderLedgerTab();
    renderDashboard();
    if (document.getElementById('tab-customers').classList.contains('active')) renderCustomersTab();
  } catch (err) {
    alert('நீக்க முடியவில்லை — இணையம் இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.');
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------------- Excel (.xlsx) export helper ----------------
   Using a real .xlsx (via SheetJS) instead of CSV avoids the classic
   problem of Tamil text turning into garbled characters when a CSV
   is opened directly in Excel — and it keeps totals as real numbers
   so he can select a column and see Excel's own sum in the status
   bar to double-check against what the app shows. */
function downloadXlsx(filename, sheetName, aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

document.getElementById('downloadLedgerBtn').addEventListener('click', () => {
  const dateISO = document.getElementById('ledgerDate').value || todayISO();
  const rows = [...customers].sort((a, b) => a.name.localeCompare(b.name, 'ta')).map(c => {
    const opening = customerOpeningForDate(c, dateISO);
    const goodsToday = customerBillsOn(c.id, dateISO).reduce((s, b) => s + b.total, 0);
    const paidToday = customerPaymentsOn(c.id, dateISO).reduce((s, p) => s + p.amount, 0);
    const total = opening + goodsToday;
    const closing = total - paidToday;
    return [c.name, round2(opening), round2(goodsToday), round2(total), round2(paidToday), round2(closing)];
  });
  // Every customer appears whether they bought anything or paid anything
  // that day or not — zero rows are kept, not filtered out, so this can
  // be used as a full daily attendance/verification sheet.
  const sums = rows.reduce((acc, r) => {
    acc[0] += r[1]; acc[1] += r[2]; acc[2] += r[3]; acc[3] += r[4]; acc[4] += r[5];
    return acc;
  }, [0, 0, 0, 0, 0]);

  const aoa = [
    [`SRI K.M. VEGETABLES — நாள் கணக்கு — ${formatDateDisplay(dateISO)}`],
    [],
    ['பெயர்', 'முதல் பாக்கி', 'பொருள் எடுக்கது', 'மொத்தம்', 'ரூ. கொடுத்தது', 'பாக்கி'],
    ...rows,
    ['மொத்தம்', ...sums.map(round2)]
  ];
  downloadXlsx(`daily-ledger_${dateISO}.xlsx`, 'Daily Ledger', aoa);
});

/* ============================================================
   MONTHLY SUMMARY — printable A4 reference sheet
   ============================================================ */
function monthBounds(monthStr) { // monthStr = 'YYYY-MM'
  const [y, m] = monthStr.split('-').map(Number);
  const first = `${y}-${pad(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
  const last = `${y}-${pad(m)}-${pad(lastDay)}`;
  return { first, last };
}
function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
(function initMonthlyPicker() {
  document.getElementById('monthlyMonth').value = currentMonthStr();
})();
document.getElementById('monthlyMonth').addEventListener('change', renderMonthlyTab);
document.getElementById('monthlyThisMonthBtn').addEventListener('click', () => {
  document.getElementById('monthlyMonth').value = currentMonthStr();
  renderMonthlyTab();
});

function computeMonthlyRows(monthStr) {
  const { first, last } = monthBounds(monthStr);
  return [...customers].sort((a, b) => a.name.localeCompare(b.name, 'ta')).map(c => {
    const opening = customerOpeningForDate(c, first); // balance just before month start
    const goods = bills
      .filter(b => b.customerId === c.id && b.dateISO >= first && b.dateISO <= last)
      .reduce((s, b) => s + b.total, 0);
    const paid = payments
      .filter(p => p.customerId === c.id && p.dateISO >= first && p.dateISO <= last)
      .reduce((s, p) => s + p.amount, 0);
    const billCount = bills.filter(b => b.customerId === c.id && b.dateISO >= first && b.dateISO <= last).length;
    const closing = opening + goods - paid;
    return { customer: c, opening, goods, paid, closing, billCount };
  });
}

function renderMonthlyTab() {
  const monthStr = document.getElementById('monthlyMonth').value || currentMonthStr();
  const [y, m] = monthStr.split('-');
  document.getElementById('monthlyMonthLabel').textContent = `${monthNameTa(Number(m))} ${y}`;

  const rows = computeMonthlyRows(monthStr);
  document.getElementById('monthlyEmpty').style.display = rows.length ? 'none' : 'block';

  const tbody = document.querySelector('#monthlyTable tbody');
  tbody.innerHTML = '';
  let sO = 0, sG = 0, sP = 0, sC = 0, totalBills = 0;
  rows.forEach(r => {
    sO += r.opening; sG += r.goods; sP += r.paid; sC += r.closing; totalBills += r.billCount;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.customer.name)}</td>
      <td class="num">${plainMoney(r.opening)}</td>
      <td class="num">${r.goods ? plainMoney(r.goods) : '—'}</td>
      <td class="num">${r.paid ? plainMoney(r.paid) : '—'}</td>
      <td class="num strong">${plainMoney(r.closing)}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('monthlySumOpening').textContent = plainMoney(sO);
  document.getElementById('monthlySumGoods').textContent = plainMoney(sG);
  document.getElementById('monthlySumPaid').textContent = plainMoney(sP);
  document.getElementById('monthlySumClosing').textContent = plainMoney(sC);

  document.getElementById('monthlyStatSales').textContent = money(sG);
  document.getElementById('monthlyStatBills').textContent = `${totalBills} பில்கள்`;
  document.getElementById('monthlyStatPaid').textContent = money(sP);
  document.getElementById('monthlyStatClosing').textContent = money(sC);
}

function monthNameTa(m) {
  const names = ['', 'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
  return names[m] || '';
}

document.getElementById('downloadMonthlyBtn').addEventListener('click', () => {
  const monthStr = document.getElementById('monthlyMonth').value || currentMonthStr();
  const [y, m] = monthStr.split('-');
  const rows = computeMonthlyRows(monthStr);
  const sums = rows.reduce((acc, r) => {
    acc[0] += r.opening; acc[1] += r.goods; acc[2] += r.paid; acc[3] += r.closing;
    return acc;
  }, [0, 0, 0, 0]);
  const aoa = [
    [`SRI K.M. VEGETABLES — மாத சுருக்கம் — ${monthNameTa(Number(m))} ${y}`],
    [],
    ['பெயர்', 'மாத தொடக்க பாக்கி', 'இம்மாத விற்பனை', 'இம்மாத வரவு', 'மாத இறுதி பாக்கி'],
    ...rows.map(r => [r.customer.name, round2(r.opening), round2(r.goods), round2(r.paid), round2(r.closing)]),
    ['மொத்தம்', ...sums.map(round2)]
  ];
  downloadXlsx(`monthly-summary_${monthStr}.xlsx`, 'Monthly Summary', aoa);
});

document.getElementById('printMonthlyBtn').addEventListener('click', () => {
  const monthStr = document.getElementById('monthlyMonth').value || currentMonthStr();
  const [y, m] = monthStr.split('-');
  const rows = computeMonthlyRows(monthStr);

  let sO = 0, sG = 0, sP = 0, sC = 0;
  const bodyRows = rows.map(r => {
    sO += r.opening; sG += r.goods; sP += r.paid; sC += r.closing;
    return `
      <tr>
        <td>${escapeHtml(r.customer.name)}</td>
        <td class="num">${plainMoney(r.opening)}</td>
        <td class="num">${r.goods ? plainMoney(r.goods) : '-'}</td>
        <td class="num">${r.paid ? plainMoney(r.paid) : '-'}</td>
        <td class="num">${plainMoney(r.closing)}</td>
      </tr>`;
  }).join('');

  const now = new Date();
  document.getElementById('monthlyPrintArea').innerHTML = `
    <div class="print-sheet">
      <div class="print-sheet-head">
        ${shop.tagline ? `<div style="font-size:11px;">${escapeHtml(shop.tagline)}</div>` : ''}
        <div class="print-sheet-logo">${escapeHtml(shop.name)}<span class="mid">${escapeHtml(shop.nameMid || '')}</span></div>
        <div class="print-sheet-bottom">${escapeHtml(shop.nameBottom || '')}</div>
        <div class="print-sheet-sub">${escapeHtml(shop.sub)} — ${escapeHtml(shop.address)} — Cell: ${escapeHtml(shop.phone)}</div>
      </div>
      <div class="print-sheet-title">மாத சுருக்கம் — ${monthNameTa(Number(m))} ${y}</div>
      <table>
        <thead>
          <tr>
            <th>பெயர்</th>
            <th class="num">மாத தொடக்க பாக்கி</th>
            <th class="num">இம்மாத விற்பனை</th>
            <th class="num">இம்மாத வரவு</th>
            <th class="num">மாத இறுதி பாக்கி</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
          <tr>
            <td>மொத்தம்</td>
            <td class="num">${plainMoney(sO)}</td>
            <td class="num">${plainMoney(sG)}</td>
            <td class="num">${plainMoney(sP)}</td>
            <td class="num">${plainMoney(sC)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="print-sheet-foot">அச்சிடப்பட்ட தேதி: ${formatDateDisplay(todayISO())} ${formatTimeDisplay(now)}</div>
    </div>
  `;
  document.body.classList.add('printing-monthly');
  window.print();
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-monthly');
});

/* ============================================================
   DATA CLEANUP — purge old bills/payments, keep balances correct
   ============================================================ */
(function initCleanupDate() {
  const d = new Date();
  const firstOfMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  document.getElementById('cleanupCutoffDate').value = firstOfMonth;
  updateCleanupInfo();
})();
document.getElementById('cleanupCutoffDate').addEventListener('change', updateCleanupInfo);

function updateCleanupInfo() {
  const cutoff = document.getElementById('cleanupCutoffDate').value;
  const info = document.getElementById('cleanupInfo');
  if (!cutoff) { info.textContent = ''; return; }
  const billCount = bills.filter(b => b.dateISO < cutoff).length;
  const payCount = payments.filter(p => p.dateISO < cutoff).length;
  info.textContent = `${formatDateDisplay(cutoff)} -க்கு முன் உள்ள ${billCount} பில்கள் மற்றும் ${payCount} பணம் பெற்ற பதிவுகள் நீக்கப்படும்.`;
}

document.getElementById('cleanupBtn').addEventListener('click', async () => {
  const cutoff = document.getElementById('cleanupCutoffDate').value;
  if (!cutoff) { alert('தேதியை தேர்வு செய்யவும்.'); return; }

  const billCount = bills.filter(b => b.dateISO < cutoff).length;
  const payCount = payments.filter(p => p.dateISO < cutoff).length;
  if (billCount === 0 && payCount === 0) {
    alert('இந்த தேதிக்கு முன் நீக்க எந்த தரவும் இல்லை.');
    return;
  }
  if (!confirm(`${formatDateDisplay(cutoff)} -க்கு முன் உள்ள ${billCount} பில்கள் மற்றும் ${payCount} பணம் பதிவுகள் நிரந்தரமாக நீக்கப்படும். ஒவ்வொரு வாடிக்கையாளரின் பாக்கி தொகை மாறாது. தொடரவா?`)) return;

  const btn = document.getElementById('cleanupBtn');
  btn.disabled = true;
  try {
    // Safety backup first, always.
    const backupData = { shop, items, customers, bills, payments, exportedAt: new Date().toISOString() };
    downloadBlob(JSON.stringify(backupData, null, 2), `sri-km-vegetables-backup-before-cleanup_${todayISO()}.json`, 'application/json');

    // Roll each customer's openingBalance forward to absorb everything before cutoff,
    // so their current/future balance stays exactly the same after we delete the rows.
    const dayBefore = (() => {
      const d = new Date(cutoff);
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    })();
    customers.forEach(c => {
      c.openingBalance = customerBalanceAsOf(c, dayBefore);
    });
    await DB.bulkUpdateOpeningBalances(customers);

    await DB.deleteBillsBefore(cutoff);
    await DB.deletePaymentsBefore(cutoff);
    bills = bills.filter(b => b.dateISO >= cutoff);
    payments = payments.filter(p => p.dateISO >= cutoff);

    alert(`நீக்கப்பட்டது. ஒரு backup பைல் தானாக பதிவிறக்கப்பட்டுள்ளது — அதை பாதுகாப்பாக வைத்துக் கொள்ளுங்கள்.`);
    updateCleanupInfo();
    renderDashboard();
    renderCustomersTab();
  } catch (err) {
    alert('நீக்குவதில் பிழை — இணையம் இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும். மேலே பதிவிறக்கிய backup பைல் பாதுகாப்பாக உள்ளது.');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
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
      <td>
        <button class="btn btn-ghost view-bill-btn" data-id="${b.id}">காண்க</button>
        <button class="btn btn-ghost btn-danger-text bill-del-btn" data-id="${b.id}" title="பில் நீக்கு">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.view-bill-btn').forEach(btn => {
    btn.addEventListener('click', () => openPrintModal(bills.find(b => b.id === btn.dataset.id)));
  });
  tbody.querySelectorAll('.bill-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteBillById(btn.dataset.id, btn));
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
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  const rows = lastReportRows.map(b => {
    const itemsStr = b.items.map(it => `${it.name} (${it.qty} ${it.unit} x ${it.price})`).join(' | ');
    return [
      b.billNo,
      formatDateDisplay(b.dateISO),
      b.timeDisplay,
      b.customerName,
      itemsStr,
      round2(b.total),
      round2(b.prevBalance),
      round2(b.grandTotal)
    ];
  });
  const sums = rows.reduce((acc, r) => {
    acc[0] += r[5]; acc[1] += r[6]; acc[2] += r[7];
    return acc;
  }, [0, 0, 0]);
  const aoa = [
    [`SRI K.M. VEGETABLES — விற்பனை அறிக்கை — ${formatDateDisplay(from)} முதல் ${formatDateDisplay(to)} வரை`],
    [],
    ['பில் எண்', 'தேதி', 'நேரம்', 'வாடிக்கையாளர்', 'பொருட்கள்', 'இன்றைய தொகை', 'முன் பாக்கி', 'மொத்தம்'],
    ...rows,
    ['', '', '', '', 'மொத்தம்', ...sums.map(round2)]
  ];
  downloadXlsx(`sales-report_${from}_to_${to}.xlsx`, 'Sales Report', aoa);
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
  document.getElementById('setShopTagline').value = shop.tagline || '';
  document.getElementById('setShopName').value = shop.name;
  document.getElementById('setShopNameMid').value = shop.nameMid || '';
  document.getElementById('setShopNameBottom').value = shop.nameBottom || '';
  document.getElementById('setShopSub').value = shop.sub;
  document.getElementById('setShopAddress').value = shop.address;
  document.getElementById('setShopPhone').value = shop.phone;
  document.getElementById('setNextBillNo').value = shop.nextBillNo;
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  shop.tagline = document.getElementById('setShopTagline').value.trim();
  shop.name = document.getElementById('setShopName').value.trim() || shop.name;
  shop.nameMid = document.getElementById('setShopNameMid').value.trim();
  shop.nameBottom = document.getElementById('setShopNameBottom').value.trim();
  shop.sub = document.getElementById('setShopSub').value.trim();
  shop.address = document.getElementById('setShopAddress').value.trim();
  shop.phone = document.getElementById('setShopPhone').value.trim();
  shop.nextBillNo = parseInt(document.getElementById('setNextBillNo').value, 10) || shop.nextBillNo;
  const btn = document.getElementById('saveSettingsBtn');
  btn.disabled = true;
  try {
    await DB.saveShop(shop);
    document.getElementById('brandShopName').textContent = shopFullName();
    const conf = document.getElementById('settingsSaved');
    conf.classList.add('show');
    setTimeout(() => conf.classList.remove('show'), 2000);
  } catch (err) {
    alert('அமைப்புகளை சேமிக்க முடியவில்லை.'); console.error(err);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- Backup / Restore ---------------- */
document.getElementById('exportDataBtn').addEventListener('click', () => {
  const data = {
    shop, items, customers, bills, payments,
    exportedAt: new Date().toISOString()
  };
  downloadBlob(JSON.stringify(data, null, 2), `sri-km-vegetables-backup_${todayISO()}.json`, 'application/json');
});

document.getElementById('importDataInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('இப்போதைய தரவு அனைத்தும் நீக்கப்பட்டு, இந்த பைலில் இருக்கும் தரவு Supabase-க்கு ஏற்றப்படும். இதற்கு சிறிது நேரம் ஆகலாம். தொடரவா?')) return;
      await DB.restoreAll(data);
      const fresh = await DB.fetchAll();
      shop = fresh.shop || shop;
      items = fresh.items;
      customers = fresh.customers;
      bills = fresh.bills;
      payments = fresh.payments;
      alert('தரவு வெற்றிகரமாக மீட்டமைக்கப்பட்டது.');
      renderDashboard();
      switchTab('dashboard');
    } catch (err) {
      alert('இந்த பைலை ஏற்ற முடியவில்லை. சரியான backup JSON பைலை தேர்வு செய்யவும்.');
      console.error(err);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ============================================================
   PRINT / RECEIPT MODAL
   ============================================================ */
/* ---------------- Modal / back-button handling ----------------
   Without this, opening a modal (bill preview, payment, add customer)
   doesn't add anything to browser history — so pressing the phone's
   back button, or swiping back, skips straight past the app entirely
   (looks like "logging out"), instead of just closing the modal.
   Fix: push a dummy history entry whenever a modal opens, and treat
   back/swipe as "close the modal" via the popstate event. */
function openModal(modalEl) {
  modalEl.classList.remove('hidden');
  history.pushState({ skvModalOpen: true }, '');
}
function closeModal(modalEl) {
  modalEl.classList.add('hidden');
  if (history.state && history.state.skvModalOpen) {
    history.back();
  }
}
window.addEventListener('popstate', () => {
  [
    document.getElementById('printModal'),
    document.getElementById('payModal'),
    document.getElementById('custModal')
  ].forEach(m => {
    if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
  });
  currentPrintBill = null;
});

const printModal = document.getElementById('printModal');
let currentPrintBill = null;

function openPrintModal(bill) {
  if (!bill) return;
  currentPrintBill = bill;
  document.getElementById('billPrintArea').innerHTML = buildReceiptHTML(bill);
  openModal(printModal);
}
document.getElementById('closePrintBtn').addEventListener('click', () => {
  closeModal(printModal);
  currentPrintBill = null;
});
document.getElementById('closePrintBtn2').addEventListener('click', () => {
  closeModal(printModal);
  currentPrintBill = null;
});

document.getElementById('deleteBillFromModalBtn').addEventListener('click', async () => {
  if (!currentPrintBill) return;
  const id = currentPrintBill.id;
  const btn = document.getElementById('deleteBillFromModalBtn');
  await deleteBillById(id, btn);
  // If it actually got deleted (bill no longer in the array), close the modal.
  if (!bills.find(b => b.id === id)) {
    closeModal(printModal);
    currentPrintBill = null;
  }
});

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
    <div class="receipt-letterhead">
      <img src="assets/logo.png" alt="${escapeHtml(shopFullName())}" class="receipt-logo-img">
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
      <div class="totals-row today-amt">
        <span>இன்றைய தொகை</span><strong>${plainMoney(b.total)}</strong>
      </div>
      <div class="totals-row"><span>முன் பாக்கி</span><strong>${plainMoney(b.prevBalance)}</strong></div>
    </div>
    <div class="receipt-line"></div>
    <div class="receipt-totals">
      <div class="totals-row grand"><span>மொத்தம்</span><strong>${plainMoney(b.grandTotal)}</strong></div>
      <div class="totals-row received-amt"><span>வரவு</span><strong>${plainMoney(b.paidToday || 0)}</strong></div>
      <div class="totals-row balance-due"><span>பாக்கித் தொகை</span><strong>${plainMoney(b.grandTotal - (b.paidToday || 0))}</strong></div>
    </div>
    <div class="receipt-foot">நன்றி! மீண்டும் வரவும்.</div>
  `;
}

/* ---------------- Save Bill (as image) & Share ----------------
   Renders #billPrintArea to a PNG using html2canvas, sized for a
   3-inch (80mm) thermal printer roll. "Share" opens the native
   Android/iOS share sheet (Web Share API) so he can pick RawBT,
   WhatsApp, Bluetooth, or whatever printer app is installed;
   "Save Bill" just downloads the same image to Photos/Downloads. */
async function renderBillToBlob() {
  const el = document.getElementById('billPrintArea');
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true
  });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

document.getElementById('downloadBillImgBtn').addEventListener('click', async () => {
  if (!currentPrintBill) return;
  const btn = document.getElementById('downloadBillImgBtn');
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '...';
  try {
    const blob = await renderBillToBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill_${currentPrintBill.billNo}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('பில்லை சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
});

document.getElementById('shareBillBtn').addEventListener('click', async () => {
  if (!currentPrintBill) return;
  const b = currentPrintBill;
  const btn = document.getElementById('shareBillBtn');
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '...';
  try {
    const blob = await renderBillToBlob();
    const file = new File([blob], `bill_${b.billNo}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `பில் #${b.billNo} - ${shopFullName()}`,
        text: `${b.customerName} — ₹${plainMoney(b.grandTotal)}`
      });
    } else {
      // Desktop / older browsers without file-share support: download the
      // image instead so he can still attach it manually to WhatsApp/printer app.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bill_${b.billNo}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert('இந்த பிரவுசரில் நேரடி Share கிடைக்கவில்லை — பில் படமாக பதிவிறக்கப்பட்டது. அதை WhatsApp / பிரிண்டர் ஆப்-ல் இணைக்கவும்.');
    }
  } catch (err) {
    if (err && err.name !== 'AbortError') alert('பகிர முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
});

/* ============================================================
   AUTH / BOOT — shop PIN gate backed by Supabase Auth
   ============================================================ */
const loginGate = document.getElementById('loginGate');
const loginForm = document.getElementById('loginForm');
const loginPinInput = document.getElementById('loginPin');
const loginError = document.getElementById('loginError');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const appShell = document.getElementById('appShell');

async function loadAllDataAndRender() {
  const data = await DB.fetchAll();
  shop = data.shop || { ...DEFAULT_SHOP };
  items = data.items;
  customers = data.customers;
  bills = data.bills;
  payments = data.payments;
  document.getElementById('brandShopName').textContent = shopFullName();
  renderDashboard();
  renderNewBillTab();
}

async function showApp() {
  loginGate.classList.add('hidden');
  appShell.classList.remove('hidden');
  try {
    await loadAllDataAndRender();
  } catch (err) {
    console.error(err);
    alert('தரவை ஏற்ற முடியவில்லை. இணையம் இணைப்பை சரிபார்த்து பக்கத்தை மீண்டும் ஏற்றவும் (Refresh).');
  }
}

function showLoginGate(message) {
  appShell.classList.add('hidden');
  loginGate.classList.remove('hidden');
  loginError.textContent = message || '';
  loginPinInput.value = '';
  loginPinInput.focus();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = loginPinInput.value.trim();
  if (!pin) return;
  loginSubmitBtn.disabled = true;
  loginError.textContent = '';
  try {
    const { error } = await DB.signInWithPin(pin);
    if (error) {
      loginError.textContent = 'தவறான PIN. மீண்டும் முயற்சிக்கவும்.';
      loginPinInput.value = '';
      loginPinInput.focus();
      return;
    }
    await showApp();
  } catch (err) {
    loginError.textContent = 'இணைய பிழை — மீண்டும் முயற்சிக்கவும்.';
    console.error(err);
  } finally {
    loginSubmitBtn.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (!confirm('வெளியேற வேண்டுமா?')) return;
  await DB.signOut();
  showLoginGate();
});

(async function boot() {
  try {
    const session = await DB.getSession();
    if (session) {
      await showApp();
    } else {
      showLoginGate();
    }
  } catch (err) {
    console.error(err);
    showLoginGate('இணைய பிழை — மீண்டும் முயற்சிக்கவும்.');
  }
})();
