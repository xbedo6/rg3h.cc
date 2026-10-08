const {spawn}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const origin='http://127.0.0.1:4351';
const server=spawn(process.execPath,['production.mjs'],{env:{...process.env,NODE_ENV:'test',PORT:'4351',APP_ORIGIN:origin,DATA_DIR:path.resolve('../growth-api-'+Date.now()),SMS_PROVIDER:'disabled',EMAIL_PROVIDER:'test',ADMIN_EMAIL:'xbedo6@gmail.com'},stdio:['ignore','pipe','pipe']});
let err='';server.stderr.on('data',v=>err+=v);
async function req(route,body,cookie='',expected=200){const r=await fetch(origin+route,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',cookie},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return {j,cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};}
async function owner(email,phone){const first=await req('/api/email/request',{kind:'owner',register:true,email,phone,name:'مالك',business:'نشاط تجريبي',password:'CorrectPass123!'});return req('/api/email/verify',{challenge:first.j.challenge,code:'123456'});}
const timeout=setTimeout(()=>{console.error('Timed out',err);server.kill();process.exitCode=1;},45000);
server.stdout.once('data',async()=>{try{
 const challenge=await req('/api/email/request',{kind:'admin',email:'xbedo6@gmail.com'}),admin=await req('/api/email/verify',{challenge:challenge.j.challenge,code:'123456'}),a=await owner('growth-a@example.com','0500000011'),b=await owner('growth-b@example.com','0500000012');
 for(const o of [a,b])await req('/api/command',{action:'activate',id:o.j.principal.account,period:'month',plan:'growth',paymentApproved:true},admin.cookie);
 const sid=a.j.principal.shop,other=b.j.principal.shop;
 const settings={shop:sid,referralsEnabled:true,referralReward:'هدية صديق',choices:[{label:'قهوة'},{label:'حلوى'}]};await req('/api/growth/settings',settings,a.cookie);
 await req('/api/growth/settings',{...settings,shop:other},a.cookie,403);await req('/api/growth/report?shop='+sid,null,'',401);await req('/api/growth/report?shop='+sid,null,b.cookie,403);await req('/api/growth/report?shop='+sid,null,admin.cookie,403);
 await req('/api/growth/report?shop='+sid+'&scope='+sid,null,admin.cookie);await req('/api/growth/report?shop='+other+'&scope='+sid,null,admin.cookie,403);
 await req('/api/growth/settings',{...settings,choices:[{label:'same'},{label:'same'}]},a.cookie,400);
 const state=(await req('/api/state?shop='+sid,null,a.cookie)).j,card=state.db.shops.find(s=>s.id===sid).card;assert.equal(card.rewardChoices.length,2);card.target=2;await req('/api/command',{action:'save-card',shop:sid,card:{...card,rewardChoices:[{id:'injected',label:'hack'}]}},a.cookie);assert.equal((await req('/api/state?shop='+sid,null,a.cookie)).j.db.shops.find(s=>s.id===sid).card.rewardChoices[0].id,card.rewardChoices[0].id);
 await req('/api/command',{action:'add-employee',name:'موظف',phone:'0500000099',username:'growth.staff',password:'123456'},a.cookie);const staff=await req('/api/staff/login',{username:'growth.staff',password:'123456'});
 await req('/api/growth/report?shop='+sid,null,staff.cookie,403);
 const inviter=await req('/api/customer/enroll',{shop:sid,name:'داعي',phone:'0500000021'}),link=await req('/api/growth/referral?shop='+sid,null,inviter.cookie),token=new URL(link.j.url).searchParams.get('ref');assert(token);assert(!JSON.stringify(link.j).includes('0500000021'));assert(!JSON.stringify(inviter.j).includes('growth-a@example.com'));
 await req('/api/growth/settings',settings,inviter.cookie,403);await req('/api/growth/report?shop='+sid,null,inviter.cookie,403);await req('/api/customer/enroll',{shop:other,name:'خطأ',phone:'0500000022',referral:token},'',400);
 const friend=await req('/api/customer/enroll',{shop:sid,name:'صديق',phone:'0500000022',referral:token});const member=friend.j.principal.member;
 const stamp=await req('/api/command',{action:'stamp',shop:sid,code:member,requestId:'one'},staff.cookie);assert.equal((await req('/api/state?shop='+sid,null,a.cookie)).j.db.shops[0].members.find(m=>m.id===member).referral.status,'waiting');
 await req('/api/command',{action:'stamp',shop:sid,code:member,requestId:'two',saleAmount:25},staff.cookie);
 let ownerState=(await req('/api/state?shop='+sid,null,a.cookie)).j;assert.equal(ownerState.db.shops[0].members.find(m=>m.id===member).referral.status,'pending');const choices=ownerState.db.shops[0].card.rewardChoices;
 await req('/api/growth/choice',{shop:sid,choiceId:'bad'},friend.cookie,400);await req('/api/growth/choice',{shop:sid,choiceId:choices[1].id},friend.cookie);
 const redemption=await req('/api/command',{action:'redeem',shop:sid,code:member,requestId:'redeem'},staff.cookie);assert.equal(redemption.j.result.reward.label,'حلوى');
 await req('/api/command',{action:'redeem',shop:sid,code:member,requestId:'again'},staff.cookie,400);
 await req('/api/command',{action:'undo',shop:sid,code:member,transaction:redemption.j.result.transaction,requestId:'undo'},staff.cookie);
 const restored=(await req('/api/state',null,friend.cookie)).j.db.shops[0].members[0];assert.equal(restored.rewards,1);assert.equal(restored.rewardChoiceId,choices[1].id);assert.equal(restored.rewardItems[0].choices.length,2);
 const report=(await req('/api/growth/report?shop='+sid,null,a.cookie)).j;assert.equal(report.metrics.sales,25);assert.equal(report.metrics.recorded,1);assert.equal(report.metrics.visits,2);assert.equal(report.metrics.coverage,50);assert.equal(report.metrics.redeemed,0);assert.equal(report.segments.ready,1);
 await req('/api/growth/report?shop='+sid+'&branchId=foreign',null,a.cookie,403);
 console.log('PASS: growth endpoints, owner/admin scope and tenant isolation, customer privacy, staff restrictions, referral links and eligibility, reward selection/redemption/undo, save-card preservation and recorded-sales accuracy.');
}catch(e){console.error(e,err);process.exitCode=1;}finally{clearTimeout(timeout);server.kill();}});
