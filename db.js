/* db.js — local JSON file database (no trucks) */
const fs=require('fs'),path=require('path');
const DATA_DIR=path.join(__dirname,'data');
const BACKUP_DIR=path.join(DATA_DIR,'backups');
const DB_FILE=path.join(DATA_DIR,'veggie-db.json');

const DEFAULT_SHOP={name:'சபரி மொத்தம் காய்கறி',sub:'மொத்த காய்கறி வியாபாரம்',address:'',phone:'91 91590 72444',owner:'சபரி',nextBillNo:1095};
const DEFAULT_ITEMS=[
  ['தேங்காய்','எண்ணிக்கை',23],['தக்காளி','கிலோ',30],['வெங்காயம்','கிலோ',35],
  ['உருளைக்கிழங்கு','கிலோ',47],['கேரட்','கிலோ',82],['பீன்ஸ்','கிலோ',60],
  ['காலிஃபிளவர்','கிலோ',45],['முட்டைகோஸ்','கிலோ',46],['கத்தரிக்காய்','கிலோ',25],
  ['வாழைக்காய்','கிலோ',30],['கோவைக்காய்','கிலோ',35],['பீர்க்கங்காய்','கிலோ',25],
  ['சுரக்காய்','கிலோ',28],['பாவக்காய்','கிலோ',14],['முள்ளங்கி','கிலோ',22],
  ['பூசணிக்காய்','கிலோ',20],['கேப்சிகம்','கிலோ',45],['வெள்ளரிக்காய்','கிலோ',20],
  ['கொத்தவரங்காய்','கிலோ',50],['அவரைக்காய்','கிலோ',40],
  ['பச்சை மிளகாய்','கிலோ',33],['கொத்தமல்லி','கட்டு',5],
  ['கறிவேப்பிலை','கட்டு',5],['இஞ்சி','கிலோ',80],['பூண்டு','கிலோ',90]
].map(([name,unit,price],i)=>({id:i+1,name,unit,price}));

function defaultData(){return{shop:{...DEFAULT_SHOP},items:DEFAULT_ITEMS.map(i=>({...i})),customers:[],bills:[],payments:[],meta:{nextIds:{items:DEFAULT_ITEMS.length+1,customers:1,bills:1,payments:1},lastBackupDate:null}};}

function ensureDirs(){if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(BACKUP_DIR))fs.mkdirSync(BACKUP_DIR,{recursive:true});}
function pad(n){return n.toString().padStart(2,'0');}
function todayISO(){const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function timeDisplay(d){let h=d.getHours();const m=pad(d.getMinutes()),a=h>=12?'PM':'AM';h=h%12||12;return`${pad(h)}:${m} ${a}`;}
function round2(n){return Math.round((Number(n)||0)*100)/100;}
function nextId(col){const id=DB.meta.nextIds[col];DB.meta.nextIds[col]=id+1;return id;}

function loadFromDisk(){
  ensureDirs();
  if(!fs.existsSync(DB_FILE)){const f=defaultData();writeToDisk(f);return f;}
  try{
    const data=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
    const fresh=defaultData();
    for(const k of Object.keys(fresh))if(!(k in data))data[k]=fresh[k];
    if(!data.meta)data.meta=fresh.meta;
    if(!data.meta.nextIds)data.meta.nextIds=fresh.meta.nextIds;
    for(const k of Object.keys(fresh.meta.nextIds))if(!(k in data.meta.nextIds))data.meta.nextIds[k]=1;
    return data;
  }catch(e){const f=defaultData();writeToDisk(f);return f;}
}
function writeToDisk(data){ensureDirs();const tmp=DB_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),'utf8');fs.renameSync(tmp,DB_FILE);}
function maybeBackup(data){
  const today=todayISO();if(data.meta.lastBackupDate===today)return;
  try{ensureDirs();if(fs.existsSync(DB_FILE))fs.copyFileSync(DB_FILE,path.join(BACKUP_DIR,`veggie-db_${today}.json`));data.meta.lastBackupDate=today;
  const files=fs.readdirSync(BACKUP_DIR).filter(f=>f.startsWith('veggie-db_')).sort();while(files.length>60)fs.unlinkSync(path.join(BACKUP_DIR,files.shift()));}catch(e){}
}

let DB=loadFromDisk();maybeBackup(DB);
function persist(){maybeBackup(DB);writeToDisk(DB);}

function getShop(){return DB.shop;}
function updateShop(patch){DB.shop={...DB.shop,...patch};persist();return DB.shop;}

function getItems(){return DB.items;}
function addItem({name,unit,price}){const it={id:nextId('items'),name,unit,price:round2(price)};DB.items.push(it);persist();return it;}
function updateItem(id,patch){const it=DB.items.find(i=>i.id===Number(id));if(!it)return null;if(patch.name!==undefined)it.name=patch.name;if(patch.unit!==undefined)it.unit=patch.unit;if(patch.price!==undefined)it.price=round2(patch.price);persist();return it;}
function deleteItem(id){const b=DB.items.length;DB.items=DB.items.filter(i=>i.id!==Number(id));persist();return DB.items.length<b;}

function getCustomers(){return DB.customers;}
function getCustomer(id){return DB.customers.find(c=>c.id===Number(id));}
function addCustomer({name,phone,bankDetails,balance}){const c={id:nextId('customers'),name,phone:phone||'',bankDetails:bankDetails||'',balance:round2(balance)||0};DB.customers.push(c);persist();return c;}
function updateCustomer(id,patch){const c=getCustomer(id);if(!c)return null;['name','phone','bankDetails'].forEach(k=>{if(patch[k]!==undefined)c[k]=patch[k];});if(patch.balance!==undefined)c.balance=round2(patch.balance);persist();return c;}
function deleteCustomer(id){const b=DB.customers.length;DB.customers=DB.customers.filter(c=>c.id!==Number(id));persist();return DB.customers.length<b;}

function getBills({from,to}={}){let l=DB.bills;if(from)l=l.filter(b=>b.dateISO>=from);if(to)l=l.filter(b=>b.dateISO<=to);return[...l].sort((a,b)=>a.createdAt-b.createdAt);}
function getBill(id){return DB.bills.find(b=>b.id===Number(id));}
function createBill({customerId,items:rows,kuli}){
  const cust=getCustomer(customerId);if(!cust)throw new Error('வாடிக்கையாளர் கிடைக்கவில்லை');
  const cleanRows=(rows||[]).map(r=>({name:r.name,unit:r.unit||'',qty:round2(r.qty),price:round2(r.price),value:round2(round2(r.qty)*round2(r.price))})).filter(r=>r.qty>0);
  if(!cleanRows.length)throw new Error('குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்');
  const total=round2(cleanRows.reduce((s,r)=>s+r.value,0));
  const prevBalance=round2(cust.balance);
  const kuliAmt=round2(kuli)||0;
  const grandTotal=round2(total+prevBalance+kuliAmt);
  const now=new Date();
  const bill={id:nextId('bills'),billNo:DB.shop.nextBillNo,dateISO:todayISO(),timeDisplay:timeDisplay(now),createdAt:now.getTime(),customerId:cust.id,customerName:cust.name,customerPhone:cust.phone||'',items:cleanRows,total,prevBalance,kuli:kuliAmt,grandTotal};
  DB.bills.push(bill);cust.balance=grandTotal;DB.shop.nextBillNo+=1;persist();return bill;
}

function getPayments({from,to,customerId}={}){let l=DB.payments;if(from)l=l.filter(p=>p.dateISO>=from);if(to)l=l.filter(p=>p.dateISO<=to);if(customerId)l=l.filter(p=>p.customerId===Number(customerId));return[...l].sort((a,b)=>a.createdAt-b.createdAt);}
function createPayment({customerId,dateISO,amount,mode,reference}){
  const cust=getCustomer(customerId);if(!cust)throw new Error('வாடிக்கையாளர் கிடைக்கவில்லை');
  const amt=round2(amount);if(!amt||amt<=0)throw new Error('தொகையை சரியாக குறிப்பிடவும்');
  const now=new Date();const balanceAfter=round2(cust.balance-amt);
  const p={id:nextId('payments'),customerId:cust.id,customerName:cust.name,dateISO:dateISO||todayISO(),timeDisplay:timeDisplay(now),createdAt:now.getTime(),amount:amt,mode:mode||'பணம் (Cash)',reference:reference||'',balanceAfter};
  DB.payments.push(p);cust.balance=balanceAfter;persist();return p;
}
function getCustomerLedger(customerId){
  const cust=getCustomer(customerId);if(!cust)return null;
  const entries=[];
  DB.bills.filter(b=>b.customerId===Number(customerId)).forEach(b=>entries.push({type:'bill',dateISO:b.dateISO,timeDisplay:b.timeDisplay,createdAt:b.createdAt,label:`பில் #${b.billNo}`,debit:b.total,credit:0,balanceAfter:b.grandTotal}));
  DB.payments.filter(p=>p.customerId===Number(customerId)).forEach(p=>entries.push({type:'payment',dateISO:p.dateISO,timeDisplay:p.timeDisplay,createdAt:p.createdAt,label:`பணம் (${p.mode})${p.reference?' - '+p.reference:''}`,debit:0,credit:p.amount,balanceAfter:p.balanceAfter}));
  entries.sort((a,b)=>a.createdAt-b.createdAt);
  return{customer:cust,entries};
}

function getDashboard(){
  const today=todayISO(),month=today.slice(0,7);
  let todaySales=0,todayCount=0,monthSales=0,monthCount=0;
  DB.bills.forEach(b=>{if(b.dateISO===today){todaySales+=b.total;todayCount++;}if(b.dateISO.slice(0,7)===month){monthSales+=b.total;monthCount++;}});
  const totalPending=DB.customers.reduce((s,c)=>s+(Number(c.balance)||0),0);
  const recentBills=[...DB.bills].sort((a,b)=>b.createdAt-a.createdAt).slice(0,8);
  return{todaySales:round2(todaySales),todayCount,monthSales:round2(monthSales),monthCount,totalPending:round2(totalPending),customerCount:DB.customers.length,itemCount:DB.items.length,recentBills};
}

function exportAll(){return JSON.parse(JSON.stringify(DB));}
function importAll(data){
  const fresh=defaultData(),merged={...fresh,...data};
  if(!merged.meta)merged.meta=fresh.meta;if(!merged.meta.nextIds)merged.meta.nextIds=fresh.meta.nextIds;
  const maxId=arr=>arr.reduce((m,x)=>Math.max(m,Number(x.id)||0),0);
  const ki=merged.meta.nextIds;
  ki.items=Math.max(ki.items||1,maxId(merged.items||[])+1);
  ki.customers=Math.max(ki.customers||1,maxId(merged.customers||[])+1);
  ki.bills=Math.max(ki.bills||1,maxId(merged.bills||[])+1);
  ki.payments=Math.max(ki.payments||1,maxId(merged.payments||[])+1);
  DB=merged;persist();return DB;
}

module.exports={getShop,updateShop,getItems,addItem,updateItem,deleteItem,getCustomers,getCustomer,addCustomer,updateCustomer,deleteCustomer,getBills,getBill,createBill,getPayments,createPayment,getCustomerLedger,getDashboard,exportAll,importAll,todayISO};
