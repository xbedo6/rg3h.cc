import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const Loyalty=createRequire(import.meta.url)('./dist/loyalty.js');
const Engagement=createRequire(import.meta.url)('./dist/engagement.js');
const DAY=86400000;
export function growthReport(shops,{days=30,inactiveDays=30,branchId='',time=Date.now()}={}){
  const since=time-days*DAY,rows=[],branches=new Map();let visits=0,redeemed=0,recorded=0,sales=0,returning=0,available=0;
  for(const sh of shops){
    const logs=(sh.logs||[]).filter(l=>!l.undone&&l.time<=time&&['stamp','redeem'].includes(l.type)),histories=new Map();
    for(const log of logs)if(log.type==='stamp'){if(!histories.has(log.member))histories.set(log.member,[]);histories.get(log.member).push(log);}
    for(const history of histories.values())history.sort((a,b)=>a.time-b.time);
    for(const m of sh.members){
      const history=histories.get(m.id)||[],recent=history.filter(l=>l.time>=since&&(!branchId||l.branchId===branchId));
      if(branchId&&!recent.length&&m.registrationBranchId!==branchId&&history.at(-1)?.branchId!==branchId)continue;
      const last=history.at(-1)?.time||null,rewards=Loyalty.available(m,sh.card),periodMoney=recent.filter(l=>Number.isFinite(l.saleAmount)&&l.saleAmount>=0);
      const isReturning=recent.some(l=>l!==history[0]);
      if(isReturning)returning++;
      available+=rewards;
      rows.push({shop:sh.id,card:sh.card.title||sh.name,id:m.id,name:m.name,phone:m.phone,joined:m.joined,lastVisit:last,visits:history.length,periodVisits:recent.length,available:rewards,nearReward:rewards===0&&(Loyalty.program(sh.card).type==='points'?(m.points||0)>0&&Loyalty.program(sh.card).pointsCost-(m.points||0)<=Loyalty.program(sh.card).pointsPerVisit*(Engagement.level(sh,m,time,history)?.multiplier||1):(m.stamps||0)===sh.card.target-1),inactive:!!last&&time-last>=inactiveDays*DAY,neverVisited:!last&&!(m.visits>0),recordedSales:periodMoney.reduce((n,l)=>n+l.saleAmount,0),recordedVisits:periodMoney.length});
    }
    for(const l of logs.filter(l=>l.time>=since&&(!branchId||l.branchId===branchId))){
      const key=l.branchId||'none';if(!branches.has(key))branches.set(key,{id:key,name:l.branchId?(l.branchName||'فرع غير محدد'):'بدون فرع',visits:0,redeemed:0,sales:0,recorded:0});const b=branches.get(key);
      if(l.type==='stamp'){visits++;b.visits++;if(Number.isFinite(l.saleAmount)&&l.saleAmount>=0){recorded++;sales+=l.saleAmount;b.recorded++;b.sales+=l.saleAmount;}}
      else{redeemed++;b.redeemed++;}
    }
  }
  const active=rows.filter(m=>m.periodVisits>0).length;
  return {days,inactiveDays,since,time,rows,segments:{inactive:rows.filter(m=>m.inactive).length,near:rows.filter(m=>m.nearReward).length,ready:rows.filter(m=>m.available>0).length,new:rows.filter(m=>m.neverVisited).length},metrics:{members:rows.length,active,visits,redeemed,returning,returnRate:active?Math.round(returning/active*100):0,available,recorded,sales:Math.round(sales*100)/100,coverage:visits?Math.round(recorded/visits*100):0},branches:[...branches.values()]};
}

export function createGrowth({load,transact,authorized,status,accountFor,fail,origin,enqueue}){
  function scope(s,p,body={},write=false){
    if(!p)fail('سجّل الدخول أولًا.',401);
    const sh=s.shops.find(x=>x.id===(body.shop||p.shop));if(!sh||sh.archivedAt)fail('البطاقة غير موجودة.',404);
    if(p.kind==='admin'){if(!body.scope||(sh.business||sh.id)!==body.scope)fail('افتح معاينة النشاط أولًا.',403);}
    else if(p.kind==='owner'){const base=authorized(s,p);if((base.business||base.id)!==(sh.business||sh.id))fail('هذه البطاقة تخص نشاطًا آخر.',403);}
    else if(p.kind==='customer'){if(p.shop!==sh.id)fail('هذه البطاقة لا تخصك.',403);}
    else fail('الإجراء غير مسموح.',403);
    if(write&&(status(accountFor(s,sh))!=='active'||sh.status!=='active'))fail('يلزم تفعيل الاشتراك.',403);
    return sh;
  }
  function attachReferral(sh,m,token){
    if(!token)return;
    if(!sh.growth?.referralsEnabled)fail('دعوات الأصدقاء غير متاحة لهذا البرنامج.');
    const inviter=sh.members.find(x=>x.referralToken===String(token)&&x.id!==m.id);
    if(!inviter||inviter.phone===m.phone)fail('رابط الدعوة غير صالح.');
    m.referral={inviter:inviter.id,status:'waiting',joinedAt:Date.now(),label:sh.growth.referralReward||'مكافأة دعوة صديق'};
  }
  function onStamp(sh,m,log){
    if(!sh.growth?.referralsEnabled||m.referral?.status!=='waiting'||!(log.saleAmount>0))return;
    m.referral={...m.referral,status:'pending',transaction:log.id,qualifyingAt:log.time,readyAt:log.time+300001};
  }
  function onUndo(sh,m,log){
    if(m.referral?.status==='pending'&&m.referral.transaction===log.id){m.referral.status='waiting';delete m.referral.transaction;delete m.referral.readyAt;}
  }
  function restore(sh,m,log){
    const beforeIds=new Set((log.before.rewardItems||[]).map(x=>x.id));
    const laterBonuses=(m.rewardItems||[]).filter(x=>x.type==='referral'&&x.earnedAt>log.time&&!beforeIds.has(x.id));
    Object.assign(m,structuredClone(log.before));
    if(!log.before.rewardItems)delete m.rewardItems;
    Loyalty.prepare(m,sh.card);
    m.rewardItems.push(...laterBonuses);m.rewards=m.rewardItems.length;
    onUndo(sh,m,log);
  }
  function settle(time=Date.now()){
    if(!load().shops.some(sh=>sh.members.some(m=>m.referral?.status==='pending'&&m.referral.readyAt<=time)))return;
    const changed=new Set();
    transact(s=>{for(const sh of s.shops){if(sh.archivedAt||sh.status!=='active'||status(accountFor(s,sh))!=='active')continue;
      for(const m of sh.members){const r=m.referral;if(r?.status!=='pending'||r.readyAt>time)continue;
        const log=sh.logs.find(l=>l.id===r.transaction&&l.member===m.id&&l.type==='stamp'&&!l.undone&&l.saleAmount>0),inviter=sh.members.find(x=>x.id===r.inviter);
        if(!log||!inviter){r.status='waiting';continue;}
        for(const target of [m,inviter]){Loyalty.prepare(target,sh.card);const id='REF-'+m.id+'-'+target.id;if(!target.rewardItems.some(x=>x.id===id))target.rewardItems.push({id,type:'referral',label:r.label,earnedAt:time});target.rewards=target.rewardItems.length;}
        r.status='awarded';r.awardedAt=time;sh.logs.unshift({id:randomUUID(),member:m.id,name:m.name,type:'referral',employee:'دعوة صديق',time,inviter:inviter.id,reward:{label:r.label}});changed.add(sh.id);
      }
    }});for(const id of changed)enqueue(id);
  }
  async function handle(req,url,p,body={}){
    const args=req.method==='GET'?Object.fromEntries(url.searchParams):body;
    const sh=scope(load(),p,args,req.method==='POST');
    if(p.kind==='customer'){
      if(url.pathname==='/api/growth/choice'&&req.method==='POST'){
        transact(s=>{const card=scope(s,p,body,true),member=card.members.find(x=>x.id===p.member);if(!member)fail('العضوية غير موجودة.',404);if(!Loyalty.nextChoices(member,card.card).some(x=>x.id===body.choiceId))fail('المكافأة المختارة غير متاحة.');member.rewardChoiceId=body.choiceId;});return {ok:true};
      }
      if(url.pathname!=='/api/growth/referral'||req.method!=='GET')fail('الإجراء غير مسموح.',403);
      if(!sh.growth?.referralsEnabled)return {enabled:false};
      scope(load(),p,args,true);const existing=sh.members.find(x=>x.id===p.member);if(!existing)fail('العضوية غير موجودة.',404);
      let token=existing.referralToken;if(!token)transact(s=>{const card=scope(s,p,args,true),member=card.members.find(x=>x.id===p.member);member.referralToken||=randomBytes(24).toString('base64url');token=member.referralToken;});
      return {enabled:true,url:origin+'/?join='+encodeURIComponent(sh.id)+'&ref='+encodeURIComponent(token),reward:sh.growth.referralReward,joined:sh.members.filter(x=>x.referral?.inviter===p.member).length,earned:sh.members.filter(x=>x.referral?.inviter===p.member&&x.referral.status==='awarded').length};
    }
    if(req.method==='GET'&&url.pathname==='/api/growth/report'){
      const days=Number(args.days||30),inactiveDays=Number(args.inactiveDays||30);if(![7,30,90,365].includes(days)||![14,30,60,90].includes(inactiveDays))fail('الفترة غير صحيحة.');
      const business=load().shops.find(x=>x.id===(sh.business||sh.id)),branchId=String(args.branchId||'');if(branchId&&!business?.branches?.some(x=>x.id===branchId))fail('الفرع لا يخص نشاطك.',403);
      const shops=args.all==='1'?load().shops.filter(x=>!x.archivedAt&&(x.business||x.id)===(sh.business||sh.id)):[sh];
      return {...growthReport(shops,{days,inactiveDays,branchId}),settings:sh.growth||{referralsEnabled:false,referralReward:'مكافأة دعوة صديق'},referrals:{joined:shops.reduce((n,c)=>n+c.members.filter(m=>m.referral).length,0),pending:shops.reduce((n,c)=>n+c.members.filter(m=>m.referral?.status==='pending').length,0),awarded:shops.reduce((n,c)=>n+c.members.filter(m=>m.referral?.status==='awarded').length,0)}};
    }
    if(req.method==='POST'&&url.pathname==='/api/growth/settings'){
      if(typeof body.referralsEnabled!=='boolean')fail('إعداد الدعوة غير صحيح.');const label=String(body.referralReward||'').trim();if(!label||label.length>45)fail('اكتب مكافأة الدعوة بحد أقصى 45 حرفًا.');
      if(!Array.isArray(body.choices)||body.choices.length>6)fail('يمكن إضافة ست مكافآت كحد أقصى.');
      const labels=body.choices.map(x=>String(x?.label||'').trim());if(labels.some(x=>!x||x.length>45)||new Set(labels).size!==labels.length)fail('أسماء المكافآت غير صحيحة أو مكررة.');
      if(Loyalty.program(sh.card).type==='discount'&&labels.length)fail('برنامج الخصم يستخدم الخصم المحدد في البطاقة.');
      transact(s=>{const card=scope(s,p,body,true);card.growth={referralsEnabled:body.referralsEnabled,referralReward:label};card.card.rewardChoices=labels.map(label=>({id:card.card.rewardChoices?.find(old=>old.label===label)?.id||randomUUID(),label}));});enqueue(sh.id);return {ok:true};
    }
    fail('المسار غير موجود.',404);
  }
  const timer=setInterval(()=>{try{settle();}catch{console.error(JSON.stringify({event:'referral_settle_failed'}));}},30000);timer.unref();
  return {handle,attachReferral,onStamp,onUndo,restore,settle};
}
