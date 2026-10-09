const {spawn}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),E=require('./dist/engagement.js');
const origin='http://127.0.0.1:4353',server=spawn(process.execPath,['production.mjs'],{env:{...process.env,NODE_ENV:'test',PORT:'4353',APP_ORIGIN:origin,DATA_DIR:path.resolve('../engagement-api-'+Date.now()),SMS_PROVIDER:'disabled',EMAIL_PROVIDER:'test',ADMIN_EMAIL:'xbedo6@gmail.com'},stdio:['ignore','pipe','pipe']});
let err='';server.stderr.on('data',v=>err+=v);
async function req(route,body,cookie='',expected=200){const r=await fetch(origin+route,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',cookie},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return {j,cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};}
async function owner(email,phone){const challenge=await req('/api/email/request',{kind:'owner',register:true,email,phone,name:'مالك',business:'نشاط اختبار',password:'CorrectPass123!'});return req('/api/email/verify',{challenge:challenge.j.challenge,code:'123456'});}
const timeout=setTimeout(()=>{console.error('Timed out',err);server.kill();process.exitCode=1;},45000);
server.stdout.once('data',async()=>{try{
 const challenge=await req('/api/email/request',{kind:'admin',email:'xbedo6@gmail.com'}),admin=await req('/api/email/verify',{challenge:challenge.j.challenge,code:'123456'}),a=await owner('eng-a@example.com','0500000041'),b=await owner('eng-b@example.com','0500000042');
 for(const o of [a,b])await req('/api/command',{action:'activate',id:o.j.principal.account,period:'month',plan:'growth',paymentApproved:true},admin.cookie);
 const business=a.j.principal.shop,other=b.j.principal.shop;
 const created=await req('/api/command',{action:'create-program',shop:business,type:'points',name:'نقاط الهدوء'},a.cookie),sid=created.j.result.program;
 await req('/api/engagement/report?shop='+sid,null,'',401);await req('/api/engagement/report?shop='+sid,null,b.cookie,403);await req('/api/engagement/report?shop='+sid,null,admin.cookie,403);await req('/api/engagement/report?shop='+sid+'&scope='+business,null,admin.cookie);await req('/api/engagement/report?shop='+other+'&scope='+business,null,admin.cookie,403);
 const north=(await req('/api/command',{action:'create-branch',shop:business,name:'الشمال'},a.cookie)).j.result.branch,south=(await req('/api/command',{action:'create-branch',shop:business,name:'الجنوب'},a.cookie)).j.result.branch;
 await req('/api/command',{action:'add-employee',shop:business,name:'موظف',phone:'0500000098',username:'eng.staff',password:'123456',branchId:north},a.cookie);const staff=await req('/api/staff/login',{username:'eng.staff',password:'123456'}),employee=(await req('/api/state',null,staff.cookie)).j.db.shops[0].employees[0].id;
 await req('/api/engagement/report?shop='+sid,null,staff.cookie,403);
 const customer=await req('/api/customer/enroll',{shop:sid,name:'عميل',phone:'0500000043'}),member=customer.j.principal.member;
 await req('/api/engagement/report?shop='+sid,null,customer.cookie,403);
 const settings=E.defaults();settings.levels.enabled=true;settings.levels.tiers=[{name:'ذهبي',threshold:1,multiplier:2,benefit:'أولوية الحجز'}];
 const now=E.clock(Date.now()),start=now.minute===0?'00:01':'00:00',end=now.minute===0?'00:00':'23:59';
 // For the last minute of a day, the overnight offer spans the entire day except 00:00.
 settings.offers=[{name:'عرض الاختبار',enabled:true,days:[0,1,2,3,4,5,6],start:now.minute===1439?'23:58':start,end:now.minute===1439?'23:57':end,from:'',until:'',branchIds:[north],multiplier:3}];
 settings.reminders[2].enabled=true;settings.reminders[2].template='reward_ready';
 await req('/api/engagement/settings',{shop:sid,settings},a.cookie);await req('/api/engagement/settings',{shop:other,settings},a.cookie,403);
 const invalid=structuredClone(settings);invalid.offers[0].branchIds=['foreign'];await req('/api/engagement/settings',{shop:sid,settings:invalid},a.cookie,400);
 const command={action:'stamp',shop:sid,code:member,requestId:'first',saleAmount:40,pointsAward:50000,multiplier:999,branchId:'foreign',time:0};
 const stamp=await req('/api/command',command,staff.cookie);assert.equal(stamp.j.result.points,30);assert.equal(stamp.j.result.pointsAdded,30);assert.equal(stamp.j.result.loyaltyLevel.name,'ذهبي');assert.equal(stamp.j.result.pointBonus.multiplier,3);assert(!JSON.stringify(stamp.j.db).includes('reward_ready'));assert(!JSON.stringify(stamp.j.db).includes('engagementPrepared'));
 const duplicate=await req('/api/command',command,staff.cookie);assert.equal(duplicate.j.result.duplicate,true);
 const undo=await req('/api/command',{action:'undo',shop:sid,code:member,requestId:'undo',transaction:stamp.j.result.transaction},staff.cookie);let current=(await req('/api/state',null,customer.cookie)).j.db.shops[0].members[0];assert.equal(current.points,0);assert.equal(current.visits,0);assert.equal(current.loyaltyLevel.name,'عضو');
 for(let i=0;i<4;i++)await req('/api/command',{...command,requestId:'point-'+i},staff.cookie);
 let prepared=await req('/api/engagement/prepare',{shop:sid},a.cookie);assert.equal(prepared.j.created,1);assert.equal(prepared.j.delivery,'draft_only');assert.equal(prepared.j.drafts[0].template,'reward_ready');assert.equal((await req('/api/engagement/prepare',{shop:sid},a.cookie)).j.created,0);
 const redeemed=await req('/api/command',{action:'redeem',shop:sid,code:member,requestId:'redeem'},staff.cookie);assert.equal(redeemed.j.result.pointsAdded,0);assert.equal(redeemed.j.result.points,20);prepared=await req('/api/engagement/prepare',{shop:sid},a.cookie);assert.equal(prepared.j.drafts[0].status,'cancelled');
 const snapshot=(await req('/api/state',null,customer.cookie)).j;assert(!JSON.stringify(snapshot).includes('eng-a@example.com'));assert(!JSON.stringify(snapshot).includes('reward_ready'));assert(!JSON.stringify(snapshot).includes('engagementPrepared'));assert(!JSON.stringify(snapshot).includes('engagementDrafts'));
 await req('/api/command',{action:'assign-employee-branch',shop:business,id:employee,branchId:south},a.cookie);const outside=await req('/api/command',{...command,requestId:'outside',branchId:north},staff.cookie);assert.equal(outside.j.result.pointsAdded,20);assert.equal(outside.j.result.pointBonus.offer,null);assert.equal(outside.j.result.branchName,'الجنوب');
 await req('/api/command',{action:'toggle-branch',shop:business,id:north},a.cookie);await req('/api/engagement/settings',{shop:sid,settings},a.cookie);settings.offers=[];await req('/api/engagement/settings',{shop:sid,settings},a.cookie);const tierStamp=await req('/api/command',{...command,requestId:'tier'},staff.cookie);assert.equal(tierStamp.j.result.pointsAdded,20);
 settings.levels.enabled=false;settings.reminders.forEach(r=>r.enabled=false);await req('/api/engagement/settings',{shop:sid,settings},a.cookie);const baseStamp=await req('/api/command',{...command,requestId:'base'},staff.cookie);assert.equal(baseStamp.j.result.pointsAdded,10);
 const report=(await req('/api/engagement/report?shop='+sid,null,a.cookie)).j;assert.equal(report.settings.levels.enabled,false);assert.equal(report.counts.base,1);
 console.log('PASS: authenticated scopes and tenant isolation; trusted time/branch/points; level progression; duplicate prevention and exact undo; offer/tier non-stacking; reminders deduplication and cancellation; customer privacy; disabled settings restore normal accrual.');
 }catch(e){console.error(e,err);process.exitCode=1;}finally{clearTimeout(timeout);server.kill();}
});
