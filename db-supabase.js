/* db-supabase.js — Supabase cloud database
   Used automatically when SUPABASE_URL env var is set.
   Same API as db.js — server.js requires whichever is available.
*/
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function pad(n){return n.toString().padStart(2,'0');}
function todayISO(){const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function timeDisplay(d){let h=d.getHours();const m=pad(d.getMinutes()),a=h>=12?'PM':'AM';h=h%12||12;return`${pad(h)}:${m} ${a}`;}
function round2(n){return Math.round((Number(n)||0)*100)/100;}
function dbErr(e){throw new Error(e.message||JSON.stringify(e));}

/* ---- Shop ---- */
async function getShop(){
  const{data,error}=await sb.from('shop_config').select('*').single();
  if(error)dbErr(error);
  return{name:data.name,sub:data.sub,address:data.address||'',phone:data.phone||'',owner:data.owner||'',nextBillNo:data.next_bill_no};
}
async function updateShop(patch){
  const update={};
  if(patch.name!==undefined)update.name=patch.name;
  if(patch.sub!==undefined)update.sub=patch.sub;
  if(patch.address!==undefined)update.address=patch.address;
  if(patch.phone!==undefined)update.phone=patch.phone;
  if(patch.owner!==undefined)update.owner=patch.owner;
  if(patch.nextBillNo!==undefined)update.next_bill_no=patch.nextBillNo;
  const{data,error}=await sb.from('shop_config').update(update).eq('id',1).select().single();
  if(error)dbErr(error);
  return{name:data.name,sub:data.sub,address:data.address||'',phone:data.phone||'',owner:data.owner||'',nextBillNo:data.next_bill_no};
}

/* ---- Items ---- */
async function getItems(){
  const{data,error}=await sb.from('items').select('*').order('name');
  if(error)dbErr(error);return data;
}
async function addItem({name,unit,price}){
  const{data,error}=await sb.from('items').insert({name,unit,price:round2(price)}).select().single();
  if(error)dbErr(error);return data;
}
async function updateItem(id,patch){
  const update={};
  if(patch.name!==undefined)update.name=patch.name;
  if(patch.unit!==undefined)update.unit=patch.unit;
  if(patch.price!==undefined)update.price=round2(patch.price);
  const{data,error}=await sb.from('items').update(update).eq('id',id).select().single();
  if(error)dbErr(error);return data;
}
async function deleteItem(id){
  const{error}=await sb.from('items').delete().eq('id',id);
  if(error)dbErr(error);return true;
}

/* ---- Customers ---- */
async function getCustomers(){
  const{data,error}=await sb.from('customers').select('*').order('name');
  if(error)dbErr(error);
  return data.map(c=>({...c,bankDetails:c.bank_details}));
}
async function getCustomer(id){
  const{data,error}=await sb.from('customers').select('*').eq('id',id).single();
  if(error||!data)return null;
  return{...data,bankDetails:data.bank_details};
}
async function addCustomer({name,phone,bankDetails,balance}){
  const{data,error}=await sb.from('customers').insert({name,phone:phone||'',bank_details:bankDetails||'',balance:round2(balance)||0}).select().single();
  if(error)dbErr(error);return{...data,bankDetails:data.bank_details};
}
async function updateCustomer(id,patch){
  const update={};
  if(patch.name!==undefined)update.name=patch.name;
  if(patch.phone!==undefined)update.phone=patch.phone;
  if(patch.bankDetails!==undefined)update.bank_details=patch.bankDetails;
  if(patch.balance!==undefined)update.balance=round2(patch.balance);
  const{data,error}=await sb.from('customers').update(update).eq('id',id).select().single();
  if(error)dbErr(error);return{...data,bankDetails:data.bank_details};
}
async function deleteCustomer(id){
  const{error}=await sb.from('customers').delete().eq('id',id);
  if(error)dbErr(error);return true;
}

/* ---- Bills ---- */
async function getBills({from,to}={}){
  let q=sb.from('bills').select('*').order('created_at');
  if(from)q=q.gte('date_iso',from);
  if(to)q=q.lte('date_iso',to);
  const{data,error}=await q;if(error)dbErr(error);
  return data.map(mapBill);
}
async function getBill(id){
  const{data,error}=await sb.from('bills').select('*').eq('id',id).single();
  if(error||!data)return null;return mapBill(data);
}
function mapBill(b){
  return{id:b.id,billNo:b.bill_no,dateISO:b.date_iso,timeDisplay:b.time_display,createdAt:b.created_at,
    customerId:b.customer_id,customerName:b.customer_name,customerPhone:b.customer_phone||'',
    items:b.items||[],total:Number(b.total),prevBalance:Number(b.prev_balance),
    kuli:Number(b.kuli||0),grandTotal:Number(b.grand_total)};
}
async function createBill({customerId,items:rows,kuli}){
  const cust=await getCustomer(customerId);
  if(!cust)throw new Error('வாடிக்கையாளர் கிடைக்கவில்லை');
  const cleanRows=(rows||[]).map(r=>({name:r.name,unit:r.unit||'',qty:round2(r.qty),price:round2(r.price),value:round2(round2(r.qty)*round2(r.price))})).filter(r=>r.qty>0);
  if(!cleanRows.length)throw new Error('குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்');
  const total=round2(cleanRows.reduce((s,r)=>s+r.value,0));
  const prevBalance=round2(cust.balance);
  const kuliAmt=round2(kuli)||0;
  const grandTotal=round2(total+prevBalance+kuliAmt);
  const shop=await getShop();
  const now=new Date();

  const{data,error}=await sb.from('bills').insert({
    bill_no:shop.nextBillNo,date_iso:todayISO(),time_display:timeDisplay(now),
    created_at:now.getTime(),customer_id:cust.id,customer_name:cust.name,
    customer_phone:cust.phone||'',items:cleanRows,total,prev_balance:prevBalance,
    kuli:kuliAmt,grand_total:grandTotal
  }).select().single();
  if(error)dbErr(error);

  // Update customer balance and shop next bill no in parallel
  await Promise.all([
    sb.from('customers').update({balance:grandTotal}).eq('id',cust.id),
    sb.from('shop_config').update({next_bill_no:shop.nextBillNo+1}).eq('id',1)
  ]);

  return mapBill(data);
}

/* ---- Payments ---- */
async function getPayments({from,to,customerId}={}){
  let q=sb.from('payments').select('*').order('created_at');
  if(from)q=q.gte('date_iso',from);
  if(to)q=q.lte('date_iso',to);
  if(customerId)q=q.eq('customer_id',Number(customerId));
  const{data,error}=await q;if(error)dbErr(error);
  return data.map(p=>({...p,customerId:p.customer_id,customerName:p.customer_name,dateISO:p.date_iso,timeDisplay:p.time_display,createdAt:p.created_at,balanceAfter:Number(p.balance_after),amount:Number(p.amount)}));
}
async function createPayment({customerId,dateISO,amount,mode,reference}){
  const cust=await getCustomer(customerId);
  if(!cust)throw new Error('வாடிக்கையாளர் கிடைக்கவில்லை');
  const amt=round2(amount);if(!amt||amt<=0)throw new Error('தொகையை சரியாக குறிப்பிடவும்');
  const now=new Date();const balanceAfter=round2(cust.balance-amt);
  const{data,error}=await sb.from('payments').insert({
    customer_id:cust.id,customer_name:cust.name,date_iso:dateISO||todayISO(),
    time_display:timeDisplay(now),created_at:now.getTime(),amount:amt,
    mode:mode||'பணம் (Cash)',reference:reference||'',balance_after:balanceAfter
  }).select().single();
  if(error)dbErr(error);
  await sb.from('customers').update({balance:balanceAfter}).eq('id',cust.id);
  return{...data,customerId:data.customer_id,customerName:data.customer_name,dateISO:data.date_iso,timeDisplay:data.time_display,createdAt:data.created_at,balanceAfter:Number(data.balance_after),amount:Number(data.amount)};
}
async function getCustomerLedger(customerId){
  const cust=await getCustomer(customerId);if(!cust)return null;
  const[{data:bills,error:e1},{data:payments,error:e2}]=await Promise.all([
    sb.from('bills').select('*').eq('customer_id',customerId).order('created_at'),
    sb.from('payments').select('*').eq('customer_id',customerId).order('created_at')
  ]);
  if(e1)dbErr(e1);if(e2)dbErr(e2);
  const entries=[];
  (bills||[]).forEach(b=>entries.push({type:'bill',dateISO:b.date_iso,timeDisplay:b.time_display,createdAt:b.created_at,label:`பில் #${b.bill_no}`,debit:Number(b.total),credit:0,balanceAfter:Number(b.grand_total)}));
  (payments||[]).forEach(p=>entries.push({type:'payment',dateISO:p.date_iso,timeDisplay:p.time_display,createdAt:p.created_at,label:`பணம் (${p.mode})${p.reference?' - '+p.reference:''}`,debit:0,credit:Number(p.amount),balanceAfter:Number(p.balance_after)}));
  entries.sort((a,b)=>a.createdAt-b.createdAt);
  return{customer:cust,entries};
}

/* ---- Dashboard ---- */
async function getDashboard(){
  const today=todayISO(),month=today.slice(0,7);
  const[{data:bills},{data:customers},{data:items}]=await Promise.all([
    sb.from('bills').select('total,date_iso,created_at,bill_no,customer_name,grand_total,id').order('created_at',{ascending:false}),
    sb.from('customers').select('balance'),
    sb.from('items').select('id')
  ]);
  let todaySales=0,todayCount=0,monthSales=0,monthCount=0;
  (bills||[]).forEach(b=>{if(b.date_iso===today){todaySales+=Number(b.total);todayCount++;}if(b.date_iso?.slice(0,7)===month){monthSales+=Number(b.total);monthCount++;}});
  const totalPending=(customers||[]).reduce((s,c)=>s+Number(c.balance||0),0);
  const recentBills=(bills||[]).slice(0,8).map(b=>({id:b.id,billNo:b.bill_no,dateISO:b.date_iso,customerName:b.customer_name,total:Number(b.total),grandTotal:Number(b.grand_total)}));
  return{todaySales:round2(todaySales),todayCount,monthSales:round2(monthSales),monthCount,totalPending:round2(totalPending),customerCount:(customers||[]).length,itemCount:(items||[]).length,recentBills};
}

/* ---- Backup / Restore ---- */
async function exportAll(){
  const[shop,items,customers,bills,payments]=await Promise.all([getShop(),getItems(),getCustomers(),getBills(),getPayments()]);
  return{shop,items,customers,bills,payments,exportedAt:new Date().toISOString()};
}
async function importAll(data){
  // Restore: update shop, upsert items/customers, insert bills/payments
  if(data.shop)await updateShop(data.shop);
  if(data.items?.length){
    await sb.from('items').delete().neq('id',0);
    await sb.from('items').insert(data.items.map(it=>({id:it.id,name:it.name,unit:it.unit,price:it.price})));
  }
  if(data.customers?.length){
    await sb.from('customers').delete().neq('id',0);
    await sb.from('customers').insert(data.customers.map(c=>({id:c.id,name:c.name,phone:c.phone||'',bank_details:c.bankDetails||'',balance:c.balance||0})));
  }
  return{ok:true};
}

module.exports={getShop,updateShop,getItems,addItem,updateItem,deleteItem,getCustomers,getCustomer,addCustomer,updateCustomer,deleteCustomer,getBills,getBill,createBill,getPayments,createPayment,getCustomerLedger,getDashboard,exportAll,importAll,todayISO};
