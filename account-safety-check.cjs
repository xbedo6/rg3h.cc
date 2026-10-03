const {spawn}=require('child_process'),{DatabaseSync}=require('node:sqlite'),assert=require('node:assert/strict'),path=require('path');
const origin='http://127.0.0.1:4324',dir=path.resolve('../account-safety-test-'+Date.now());
const server=spawn(process.execPath,['production.mjs'],{env:{...process.env,NODE_ENV:'test',PORT:'4324',APP_ORIGIN:origin,DATA_DIR:dir,EMAIL_PROVIDER:'test',SMS_PROVIDER:'disabled',ADMIN_EMAIL:'xbedo6@gmail.com'},stdio:['ignore','pipe','pipe']});
let err='';server.stderr.on('data',c=>err+=c);
async function q(url,body,cookie='',expected=200){const r=await fetch(origin+url,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',cookie},body:body?JSON.stringify(body):undefined}),j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return {j,cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};}
async function verify(ch){return q('/api/email/verify',{challenge:ch,code:'123456'});}
async function owner(i){return verify((await q('/api/email/request',{kind:'owner',register:true,email:`owner${i}@audit.test`,phone:'050123456'+i,name:'مالك '+i,business:'نشاط '+i,password:'AuditPass123!'})).j.challenge);}
server.stdout.once('data',async()=>{try{
 const admin=await verify((await q('/api/email/request',{kind:'admin',email:'xbedo6@gmail.com'})).j.challenge),a=await owner(1),b=await owner(2),sid=a.j.principal.shop,other=b.j.principal.shop;
 for(const o of [a,b])await q('/api/command',{action:'activate',id:o.j.principal.account,period:'month',plan:'growth',paymentApproved:true},admin.cookie);
 const second=(await q('/api/command',{action:'create-program',name:'بطاقة ثانية',type:'visits'},a.cookie)).j.result.program;
 const customer=await q('/api/customer/enroll',{shop:sid,name:'عميل',phone:'0505555555'});
 for(const result of [customer,await q('/api/state',null,customer.cookie)]){
  assert.equal(result.j.db.shops.length,1);assert.equal(result.j.db.shops[0].members.length,1);assert.deepEqual(result.j.db.shops[0].employees,[]);assert.deepEqual(result.j.db.shops[0].branches,[]);assert.deepEqual(result.j.db.shops[0].logs,[]);
  assert(!JSON.stringify(result.j).includes('owner1@audit.test'));assert(!('email' in result.j.db.accounts[0]));assert(!('plan' in result.j.db.accounts[0].subscription));assert(!('expires' in result.j.db.accounts[0].subscription));assert(!('account' in result.j.principal));
 }
 const publicCard=(await q('/api/public/shop?id='+sid)).j.db.shops[0];assert.deepEqual(Object.keys(publicCard).sort(),['id','name','status','card','members','employees','branches','logs'].sort());
 const scoped=(await q('/api/state?scope='+sid+'&shop='+second,null,admin.cookie)).j;
 assert.equal(scoped.db.scopedBusiness,sid);assert.deepEqual(scoped.db.shops.map(s=>s.id).sort(),[sid,second].sort());assert.equal(scoped.db.accounts.length,1);assert.equal(scoped.db.accounts[0].id,a.j.principal.account);assert.equal(scoped.principal.kind,'admin');assert.equal(scoped.db.tokens.length,0);
 await q('/api/state?scope='+sid+'&shop='+other,null,admin.cookie,403);await q('/api/state?scope='+other,null,a.cookie,403);
 await q('/api/command',{action:'delete-program',shop:other,scope:sid},admin.cookie,403);
 await q('/api/command',{action:'create-program',shop:sid,scope:sid,name:'بطاقة المعاينة',type:'visits'},admin.cookie);
 const full=(await q('/api/state',null,admin.cookie)).j;assert(full.db.shops.some(s=>s.id===other));assert(!full.db.scopedBusiness);
 await q('/api/command',{action:'add-employee',shop:sid,name:'موظف',phone:'0506666666',username:'safety.staff',password:'123456',programs:[sid]},a.cookie);
 const staff=await q('/api/staff/login',{username:'safety.staff',password:'123456'}),issue={shop:sid,phone:'0505555555',ownershipConfirmed:true};
 await q('/api/customer/recovery/issue',issue,'',401);await q('/api/customer/recovery/issue',issue,customer.cookie,403);await q('/api/customer/recovery/issue',issue,b.cookie,403);
 await q('/api/customer/recovery/issue',{...issue,ownershipConfirmed:false},staff.cookie,400);await q('/api/customer/recovery/issue',{...issue,shop:other},staff.cookie,403);
 const first=(await q('/api/customer/recovery/issue',issue,staff.cookie)).j,secondLink=(await q('/api/customer/recovery/issue',issue,staff.cookie)).j;
 assert(first.url.includes('#'));const token=url=>new URL(url).hash.slice(1);
 await q('/api/customer/recovery/consume',{token:token(first.url)},'',400);
 const restored=await q('/api/customer/recovery/consume',{token:token(secondLink.url)});
 assert.equal(restored.j.principal.member,customer.j.principal.member);assert(!JSON.stringify(restored.j).includes('owner1@audit.test'));
 await q('/api/customer/recovery/consume',{token:token(secondLink.url)},'',400);await q('/api/state',null,customer.cookie,401);
 const expiry=(await q('/api/customer/recovery/issue',issue,a.cookie)).j;
 const sqlite=new DatabaseSync(path.join(dir,'rijaa.sqlite'));sqlite.prepare('UPDATE customer_recovery SET expires=? WHERE used=0').run(Date.now()-1000);sqlite.close();
 await q('/api/customer/recovery/consume',{token:token(expiry.url)},'',400);
 await q('/api/customer/recovery/consume',{token:'bad'},'',400);
 const disabled=(await q('/api/customer/recovery/issue',issue,staff.cookie)).j;
 await q('/api/command',{action:'toggle-employee',id:staff.j.principal.employee},a.cookie);
 await q('/api/customer/recovery/consume',{token:token(disabled.url)},'',400);
 console.log('PASS: minimal customer/public DTO, admin scope isolation and cross-scope command rejection, full admin return, recovery authentication/scope/ownership confirmation, replacement/expiry/single-use, previous customer session revocation and disabled issuer rejection.');
}catch(e){console.error(e,err);process.exitCode=1;}finally{server.kill();}});
