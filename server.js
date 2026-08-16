const express=require('express'),path=require('path'),crypto=require('crypto');
const db=process.env.SUPABASE_URL?require('./db-supabase'):require('./db');
const app=express(),PORT=process.env.PORT||4500;
const SECRET=process.env.AUTH_SECRET||'vb-secret-2024';
app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(__dirname,'public')));
function makeToken(pw){return crypto.createHmac('sha256',SECRET).update(pw).digest('hex');}
app.use('/api',async(req,res,next)=>{
  if(req.path==='/login')return next();
  const auth=req.headers.authorization||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token)return res.status(401).json({error:'unauthorized'});
  try{
    const shop=await db.getShop();
    const pw=process.env.APP_PASSWORD||shop.appPassword||'billing123';
    if(token!==makeToken(pw))return res.status(401).json({error:'unauthorized'});
    next();
  }catch(e){res.status(401).json({error:'unauthorized'});}
});
app.post('/api/login',async(req,res)=>{
  try{
    const{password}=req.body;
    const shop=await db.getShop();
    const correct=process.env.APP_PASSWORD||shop.appPassword||'billing123';
    if(password!==correct)return res.status(401).json({error:'கடவுச்சொல் தவறு. மீண்டும் முயற்சிக்கவும்.'});
    res.json({token:makeToken(password),shopName:shop.name});
  }catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/change-password',async(req,res)=>{
  try{
    const{currentPassword,newPassword}=req.body;
    const shop=await db.getShop();
    const correct=process.env.APP_PASSWORD||shop.appPassword||'billing123';
    if(currentPassword!==correct)return res.status(400).json({error:'தற்போதைய கடவுச்சொல் தவறு'});
    if(!newPassword||newPassword.length<4)return res.status(400).json({error:'புதிய கடவுச்சொல் 4 எழுத்து இருக்க வேண்டும்'});
    await db.updateShop({appPassword:newPassword});
    res.json({token:makeToken(newPassword),message:'கடவுச்சொல் மாற்றப்பட்டது'});
  }catch(e){res.status(500).json({error:e.message});}
});
async function h(res,fn){try{res.json(await fn());}catch(e){res.status(400).json({error:e.message||String(e)});}}
app.get('/api/shop',(q,r)=>h(r,()=>db.getShop()));
app.put('/api/shop',(q,r)=>h(r,()=>db.updateShop(q.body)));
app.get('/api/items',(q,r)=>h(r,()=>db.getItems()));
app.post('/api/items',(q,r)=>h(r,()=>db.addItem(q.body)));
app.put('/api/items/:id',(q,r)=>h(r,()=>db.updateItem(q.params.id,q.body)));
app.delete('/api/items/:id',(q,r)=>h(r,()=>({deleted:db.deleteItem(q.params.id)})));
app.get('/api/customers',(q,r)=>h(r,()=>db.getCustomers()));
app.post('/api/customers',(q,r)=>h(r,()=>db.addCustomer(q.body)));
app.put('/api/customers/:id',(q,r)=>h(r,()=>db.updateCustomer(q.params.id,q.body)));
app.delete('/api/customers/:id',(q,r)=>h(r,()=>({deleted:db.deleteCustomer(q.params.id)})));
app.get('/api/customers/:id/ledger',(q,r)=>h(r,async()=>{const l=await db.getCustomerLedger(q.params.id);if(!l)throw new Error('இல்லை');return l;}));
app.get('/api/bills',(q,r)=>h(r,()=>db.getBills(q.query)));
app.get('/api/bills/:id',(q,r)=>h(r,async()=>{const b=await db.getBill(q.params.id);if(!b)throw new Error('இல்லை');return b;}));
app.post('/api/bills',(q,r)=>h(r,()=>db.createBill(q.body)));
app.get('/api/payments',(q,r)=>h(r,()=>db.getPayments(q.query)));
app.post('/api/payments',(q,r)=>h(r,()=>db.createPayment(q.body)));
app.get('/api/dashboard',(q,r)=>h(r,()=>db.getDashboard()));
app.get('/api/export',(q,r)=>h(r,()=>db.exportAll()));
app.post('/api/import',(q,r)=>h(r,()=>db.importAll(q.body)));
app.listen(PORT,()=>{
  const mode=process.env.SUPABASE_URL?'Supabase':'Local JSON';
  console.log(`\n  Veggie Billing v4 (${mode}) — http://localhost:${PORT}`);
  console.log('  Default password: billing123\n');
});
