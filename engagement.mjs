import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const E=createRequire(import.meta.url)('./dist/engagement.js');
const tidy=(v,n)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)throw Error('اكتب قيمة صحيحة ضمن الحد المسموح.');return v.trim();};
const integer=(v,a,b)=>{if(!Number.isInteger(v)||v<a||v>b)throw Error('القيمة الرقمية خارج الحد المسموح.');return v;};
const bool=v=>{if(typeof v!=='boolean')throw Error('خيار التفعيل غير صحيح.');return v;};
const date=v=>{if(!v)return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('التاريخ غير صحيح.');return v;};
const time=v=>{if(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('الوقت غير صحيح.');return v;};
function histories(sh,time){const map=new Map();for(const l of sh.logs||[]){if(l.type!=='stamp'||l.undone||l.time>time)continue;if(!map.has(l.member))map.set(l.member,[]);map.get(l.member).push(l);}return map;}
function levelKeys(sh,time){let changed=false;const logs=histories(sh,time);for(const m of sh.members){const level=E.level(sh,m,time,logs.get(m.id)||[]),key=level?JSON.stringify([level.name,level.benefit]):'';if((m.engagementWalletLevel||'')!==key){m.engagementWalletLevel=key;changed=true;}}return changed;}
export function validateSettings(input,sh,branches){
 const c=input?.levels;if(!c||!['visits','spend'].includes(c.metric)||![0,90,365].includes(c.window)||!Array.isArray(c.tiers)||c.tiers.length<1||c.tiers.length>3)throw Error('أضف من مستوى إلى ثلاثة مستويات وحدد طريقة الاحتساب.');
 const levels={enabled:bool(c.enabled),metric:c.metric,window:c.window,tiers:c.tiers.map((t,i)=>({id:'tier-'+i,name:tidy(t.name,24),threshold:integer(t.threshold,1,10000000),multiplier:integer(t.multiplier,1,3),benefit:t.benefit?tidy(t.benefit,120):''}))};
 if(levels.tiers.some((t,i)=>i&&t.threshold<=levels.tiers[i-1].threshold)||new Set(levels.tiers.map(t=>t.name)).size!==levels.tiers.length)throw Error('رتّب حدود المستويات تصاعديًا، دون تكرار الأسماء.');
 const points=sh.card.program?.type==='points';if(!points&&levels.tiers.some(t=>t.multiplier!==1))throw Error('مضاعفة النقاط متاحة لبرامج النقاط فقط.');
 if(!Array.isArray(input.offers)||input.offers.length>6)throw Error('يمكن إضافة ستة عروض كحد أقصى.');
 const offers=input.offers.map((o,i)=>{
  if(!Array.isArray(o.days)||!o.days.length||o.days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('حدد أيام العرض.');
  if(!Array.isArray(o.branchIds)||o.branchIds.some(id=>!branches.some(b=>b.id===id)))throw Error('حدد فروعًا تابعة لنشاطك.');
  const start=time(o.start),end=time(o.end),from=date(o.from),until=date(o.until);if(start===end||from&&until&&from>until)throw Error('فترة العرض غير صحيحة.');
  const enabled=bool(o.enabled);if(enabled&&!points)throw Error('عروض مضاعفة النقاط تتطلب بطاقة بنظام النقاط.');
  return {id:'offer-'+i,name:tidy(o.name,40),enabled,days:[...new Set(o.days)],start,end,from,until,branchIds:[...new Set(o.branchIds)],multiplier:integer(o.multiplier,2,5)};
 });
 if(!Array.isArray(input.reminders)||input.reminders.length!==3||new Set(input.reminders.map(r=>r.id)).size!==3||input.reminders.some(r=>!['inactive','near','ready'].includes(r.id)))throw Error('قواعد التذكير غير صحيحة.');
 const reminders=input.reminders.map(r=>{const template=r.template?tidy(r.template,512):'',language=tidy(r.language||'ar',10);if(template&&!/^[a-z0-9_]+$/.test(template)||!/^([a-z]{2})(_[A-Z]{2})?$/.test(language))throw Error('اسم قالب ميتا أو لغته غير صحيح.');return {id:r.id,enabled:bool(r.enabled),days:integer(r.days,7,180),cooldown:integer(r.cooldown,1,90),template,language};});
 return {levels,offers,reminders};
}
export function prepareDrafts(sh,time=Date.now()){
 const rules=E.settings(sh).reminders,existing=sh.engagementDrafts||[],members=new Map(sh.members.map(m=>[m.id,m])),logs=histories(sh,time);let changed=false,created=0;
 for(const d of existing){if(d.status!=='draft')continue;const rule=rules.find(r=>r.id===d.rule),m=members.get(d.member);if(!rule?.enabled||!m||!E.candidate(sh,m,rule,time,logs.get(m.id)||[])||d.createdAt+7*E.DAY<=time){d.status='cancelled';d.closedAt=time;changed=true;}}
 const pending=new Set(existing.filter(d=>d.status==='draft').map(d=>d.rule+':'+d.member));
 for(const r of rules.filter(r=>r.enabled))for(const m of [...sh.members].sort((a,b)=>(a.engagementPrepared?.[r.id]||0)-(b.engagementPrepared?.[r.id]||0))){if(pending.size>=1000||!E.candidate(sh,m,r,time,logs.get(m.id)||[])||pending.has(r.id+':'+m.id)||(m.engagementPrepared?.[r.id]!==undefined&&time-m.engagementPrepared[r.id]<r.cooldown*E.DAY))continue;
  existing.push({id:randomUUID(),rule:r.id,member:m.id,createdAt:time,status:'draft',template:r.template,language:r.language});pending.add(r.id+':'+m.id);m.engagementPrepared={...m.engagementPrepared,[r.id]:time};created++;changed=true;
 }
 if(changed){sh.engagementDrafts=[...existing.filter(d=>d.status==='draft'),...existing.filter(d=>d.status!=='draft')].slice(0,1000).sort((a,b)=>b.createdAt-a.createdAt);}
 return {created,changed};
}
export function createEngagement({load,transact,authorized,status,accountFor,fail,enqueue}){
 function scope(s,p,a,write=false){if(!p)fail('سجّل الدخول أولًا.',401);const sh=s.shops.find(x=>x.id===(a.shop||p.shop));if(!sh||sh.archivedAt)fail('البطاقة غير موجودة.',404);
  if(p.kind==='admin'){if(!a.scope||a.scope!==(sh.business||sh.id))fail('افتح معاينة النشاط أولًا.',403);}
  else if(p.kind==='owner'){const base=authorized(s,p);if((base.business||base.id)!==(sh.business||sh.id))fail('هذه البطاقة تخص نشاطًا آخر.',403);}
  else fail('الإجراء خاص بصاحب النشاط.',403);
  if(write&&(status(accountFor(s,sh))!=='active'||sh.status!=='active'))fail('يلزم تفعيل الاشتراك.',403);return sh;
 }
 function report(sh){const time=Date.now(),settings=E.settings(sh),logs=histories(sh,time),rows=sh.members.map(m=>({id:m.id,name:m.name,phone:m.phone,level:E.level(sh,m,time,logs.get(m.id)||[])})),counts={base:0},names=new Map(sh.members.map(m=>[m.id,m.name]));for(const t of settings.levels.tiers)counts[t.id]=0;for(const r of rows)counts[r.level?.id||'base']=(counts[r.level?.id||'base']||0)+1;
  return {settings,time,rows,counts,reminders:settings.reminders.map(r=>({...r,eligible:sh.members.filter(m=>E.candidate(sh,m,r,time,logs.get(m.id)||[])).length})),drafts:(sh.engagementDrafts||[]).slice(0,100).map(d=>({...d,name:names.get(d.member)||'عضوية محذوفة'})),delivery:'draft_only',timezone:'Asia/Riyadh'};
 }
 async function handle(req,url,p,body={}){const args=req.method==='GET'?Object.fromEntries(url.searchParams):body,sh=scope(load(),p,args,req.method==='POST');
  if(req.method==='GET'&&url.pathname==='/api/engagement/report')return report(sh);
  if(req.method==='POST'&&url.pathname==='/api/engagement/settings'){
   const business=load().shops.find(x=>x.id===(sh.business||sh.id));let next;try{next=validateSettings(body.settings,sh,business.branches||[]);}catch(e){fail(e.message);}
   const prior=JSON.stringify(E.settings(sh).levels),updated=JSON.stringify(next.levels);transact(s=>{const current=scope(s,p,body,true);current.engagement=next;prepareDrafts(current);levelKeys(current,Date.now());});
   if(prior!==updated&&(sh.engagement?.levels?.enabled||next.levels.enabled))enqueue(sh.id);return {ok:true,...report(load().shops.find(x=>x.id===sh.id))};
  }
  if(req.method==='POST'&&url.pathname==='/api/engagement/prepare'){let result;transact(s=>{result=prepareDrafts(scope(s,p,body,true));});return {...result,...report(load().shops.find(x=>x.id===sh.id))};}
  fail('المسار غير موجود.',404);
 }
 function settle(now=Date.now()){const s=load(),changes=[];for(const sh of s.shops){const settings=E.settings(sh);if(sh.archivedAt||sh.status!=='active'||status(accountFor(s,sh))!=='active'||!settings.levels.enabled&&!settings.reminders.some(r=>r.enabled)&&!(sh.engagementDrafts||[]).some(d=>d.status==='draft'))continue;
   const preview={...sh,members:sh.members.map(m=>({...m,engagementPrepared:{...m.engagementPrepared}})),engagementDrafts:structuredClone(sh.engagementDrafts||[])};
   const walletChanged=levelKeys(preview,now),draftsChanged=prepareDrafts(preview,now).changed;if(walletChanged||draftsChanged)changes.push({preview,walletChanged});
  }
  if(!changes.length)return;transact(current=>{for(const {preview} of changes){const sh=current.shops.find(x=>x.id===preview.id);sh.engagementDrafts=preview.engagementDrafts;const members=new Map(preview.members.map(m=>[m.id,m]));for(const m of sh.members){m.engagementPrepared=members.get(m.id).engagementPrepared;m.engagementWalletLevel=members.get(m.id).engagementWalletLevel;}}});for(const {preview,walletChanged} of changes)if(walletChanged)enqueue(preview.id);
 }
 const timer=setInterval(()=>{try{settle();}catch{console.error(JSON.stringify({event:'engagement_prepare_failed'}));}},60000);timer.unref();
 return {handle,settle};
}
