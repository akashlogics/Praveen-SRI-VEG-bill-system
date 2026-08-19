/* ============================================================
   db.js — Supabase data access layer for SRI K.M. VEGETABLES
   Loaded after config.js and the Supabase CDN script, before app.js.

   Exposes a single global `DB` object. Its methods return/accept
   the exact same camelCase object shapes the app already uses
   internally (shop, item, customer, bill, payment) — app.js's
   rendering and business logic never had to change, only the
   handful of places that used to call localStorage's save().
   ============================================================ */

const supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

/* ---------------- row <-> app-object mappers ---------------- */
function rowToShop(row) {
  if (!row) return null;
  return {
    tagline: row.tagline || '',
    name: row.name,
    nameMid: row.name_mid || '',
    nameBottom: row.name_bottom || '',
    sub: row.sub || '',
    address: row.address || '',
    phone: row.phone || '',
    nextBillNo: row.next_bill_no
  };
}
function shopToRow(s) {
  return {
    id: 1,
    tagline: s.tagline || '',
    name: s.name,
    name_mid: s.nameMid || '',
    name_bottom: s.nameBottom || '',
    sub: s.sub || '',
    address: s.address || '',
    phone: s.phone || '',
    next_bill_no: s.nextBillNo
  };
}
function rowToItem(row) {
  return { id: row.id, name: row.name, unit: row.unit, price: Number(row.price) };
}
function itemToRow(it) {
  return { id: it.id, name: it.name, unit: it.unit, price: it.price };
}
function rowToCustomer(row) {
  return { id: row.id, name: row.name, phone: row.phone || '', openingBalance: Number(row.opening_balance) || 0 };
}
function customerToRow(c) {
  return { id: c.id, name: c.name, phone: c.phone || '', opening_balance: c.openingBalance || 0 };
}
function rowToBill(row) {
  return {
    id: row.id,
    billNo: row.bill_no,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || '',
    dateISO: row.date_iso,
    timeDisplay: row.time_display,
    createdAt: Number(row.created_at_ms),
    items: row.items_json || [],
    total: Number(row.total),
    prevBalance: Number(row.prev_balance),
    grandTotal: Number(row.grand_total)
  };
}
function billToRow(b) {
  return {
    id: b.id,
    bill_no: b.billNo,
    customer_id: b.customerId,
    customer_name: b.customerName,
    customer_phone: b.customerPhone || '',
    date_iso: b.dateISO,
    time_display: b.timeDisplay,
    created_at_ms: b.createdAt,
    items_json: b.items,
    total: b.total,
    prev_balance: b.prevBalance,
    grand_total: b.grandTotal
  };
}
function rowToPayment(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    dateISO: row.date_iso,
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: Number(row.created_at_ms)
  };
}
function paymentToRow(p) {
  return {
    id: p.id,
    customer_id: p.customerId,
    date_iso: p.dateISO,
    amount: p.amount,
    note: p.note || '',
    created_at_ms: p.createdAt
  };
}

function throwIfError({ error }) {
  if (error) throw error;
}

const DB = {
  /* ---------- AUTH ---------- */
  async getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  },
  async signInWithPin(pin) {
    return supabaseClient.auth.signInWithPassword({
      email: SUPABASE_CONFIG.loginEmail,
      password: pin
    });
  },
  async signOut() {
    return supabaseClient.auth.signOut();
  },

  /* ---------- FETCH ALL (called once, right after login) ---------- */
  async fetchAll() {
    const [shopRes, itemsRes, custRes, billsRes, payRes] = await Promise.all([
      supabaseClient.from('shop_settings').select('*').eq('id', 1).maybeSingle(),
      supabaseClient.from('items').select('*').order('name'),
      supabaseClient.from('customers').select('*').order('name'),
      supabaseClient.from('bills').select('*').order('created_at_ms'),
      supabaseClient.from('payments').select('*').order('created_at_ms')
    ]);
    throwIfError(shopRes);
    throwIfError(itemsRes);
    throwIfError(custRes);
    throwIfError(billsRes);
    throwIfError(payRes);

    return {
      shop: rowToShop(shopRes.data),
      items: itemsRes.data.map(rowToItem),
      customers: custRes.data.map(rowToCustomer),
      bills: billsRes.data.map(rowToBill),
      payments: payRes.data.map(rowToPayment)
    };
  },

  /* ---------- SHOP SETTINGS (single row, id = 1) ---------- */
  async saveShop(shop) {
    throwIfError(await supabaseClient.from('shop_settings').upsert(shopToRow(shop)));
  },

  /* ---------- ITEMS ---------- */
  async upsertItem(item) {
    throwIfError(await supabaseClient.from('items').upsert(itemToRow(item)));
  },
  async deleteItem(id) {
    throwIfError(await supabaseClient.from('items').delete().eq('id', id));
  },

  /* ---------- CUSTOMERS ---------- */
  async upsertCustomer(cust) {
    throwIfError(await supabaseClient.from('customers').upsert(customerToRow(cust)));
  },
  async deleteCustomer(id) {
    throwIfError(await supabaseClient.from('customers').delete().eq('id', id));
  },
  // Used by Data Cleanup: rolls the purged range's net effect into
  // each customer's opening_balance. One row at a time — customer
  // lists here are small (tens, not thousands), so simplicity wins
  // over batching.
  async bulkUpdateOpeningBalances(customersArr) {
    for (const c of customersArr) {
      throwIfError(
        await supabaseClient.from('customers').update({ opening_balance: c.openingBalance }).eq('id', c.id)
      );
    }
  },

  /* ---------- BILLS ---------- */
  async insertBill(bill) {
    throwIfError(await supabaseClient.from('bills').insert(billToRow(bill)));
  },
  async deleteBill(id) {
    throwIfError(await supabaseClient.from('bills').delete().eq('id', id));
  },
  async deleteBillsBefore(dateISO) {
    throwIfError(await supabaseClient.from('bills').delete().lt('date_iso', dateISO));
  },

  /* ---------- PAYMENTS ---------- */
  async insertPayment(payment) {
    throwIfError(await supabaseClient.from('payments').insert(paymentToRow(payment)));
  },
  async deletePaymentsBefore(dateISO) {
    throwIfError(await supabaseClient.from('payments').delete().lt('date_iso', dateISO));
  },

  /* ---------- FULL RESTORE (from a JSON backup file) ----------
     Wipes every row in all four tables, then bulk-inserts from the
     backup. Order matters: bills/payments reference customers, so
     children go first on the way out, parents first on the way in. */
  async restoreAll(data) {
    throwIfError(await supabaseClient.from('bills').delete().neq('id', '__none__'));
    throwIfError(await supabaseClient.from('payments').delete().neq('id', '__none__'));
    throwIfError(await supabaseClient.from('items').delete().neq('id', '__none__'));
    throwIfError(await supabaseClient.from('customers').delete().neq('id', '__none__'));

    if (data.shop) await this.saveShop(data.shop);
    if (data.items && data.items.length) {
      throwIfError(await supabaseClient.from('items').insert(data.items.map(itemToRow)));
    }
    if (data.customers && data.customers.length) {
      throwIfError(await supabaseClient.from('customers').insert(data.customers.map(customerToRow)));
    }
    if (data.bills && data.bills.length) {
      throwIfError(await supabaseClient.from('bills').insert(data.bills.map(billToRow)));
    }
    if (data.payments && data.payments.length) {
      throwIfError(await supabaseClient.from('payments').insert(data.payments.map(paymentToRow)));
    }
  }
};
