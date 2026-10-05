import {randomUUID} from 'node:crypto';
import {createMarketingContacts} from './marketing-contacts.mjs';
export function createMarketing({sql,load,fail,rate,env=process.env,fetcher=fetch}){
 const contacts=createMarketingContacts({sql,load,fail});
 sql.exec(`CREATE TABLE IF NOT EXISTS marketing_settings(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS marketing_drafts(id TEXT PRIMARY KEY,kind TEXT NOT NULL,json TEXT NOT NULL,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS marketing_tests(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,template TEXT NOT NULL,status TEXT NOT NULL,message_id TEXT,created INTEGER NOT NULL);`);
 const text=(v,n)=>String(v||'').trim().slice(0,n);
 const config=()=>JSON.parse(sql.prepare('SELECT json FROM marketing_settings WHERE id=1').get()?.json||'{}');
 const list=kind=>sql.prepare('SELECT id,json,updated FROM marketing_drafts WHERE kind=? ORDER BY updated DESC LIMIT 100').all(kind).map(x=>({...JSON.parse(x.json),id:x.id,updated:x.updated}));
 const ready=()=>!!(env.META_WHATSAPP_TOKEN&&config().wabaId&&config().phoneId&&config().version);
 async function graph(suffix,method='GET',payload){if(!ready())fail('أكمل معرّفات الربط واحفظ META_WHATSAPP_TOKEN سرّيًا في الاستضافة.',409);const c=config();let r;try{r=await fetcher(`https://graph.facebook.com/${c.version}/${suffix}`,{method,headers:{Authorization:`Bearer ${env.META_WHATSAPP_TOKEN}`,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(15000)});}catch{fail('تعذر تأكيد استجابة ميتا. لا تكرر الإرسال قبل مراجعة سجل ميتا.',502);}let data;try{data=await r.json();}catch{fail('استجابة ميتا غير مكتملة.',502);}if(!r.ok)fail('رفضت ميتا الطلب. رمز الخطأ: '+(data.error?.code||r.status),502);return data;}
 async function handle(req,url,principal,b={}){
  if(principal?.kind!=='admin')fail('قسم التسويق متاح للإدارة فقط.',403);
  rate('marketing-admin:'+principal.account,60,60000);
  if(url.pathname==='/api/marketing/contacts'||url.pathname.startsWith('/api/marketing/contact-'))return contacts.handle(req,url,principal,b);
  if(req.method==='POST'&&url.pathname==='/api/marketing/audience'){const rows=contacts.filtered(b),eligible=rows.filter(c=>!c.archived&&c.consent==='opted_in');return {total:rows.length,eligible:eligible.length,excluded:rows.length-eligible.length,sample:eligible.slice(0,10).map(c=>({id:c.id,name:c.name,phone:c.phone}))};}
  if(req.method==='GET'&&url.pathname==='/api/marketing/state')return {catalog:contacts.catalog(),settings:config(),tokenConfigured:!!env.META_WHATSAPP_TOKEN,ready:ready(),templates:list('template'),campaigns:list('campaign'),tests:sql.prepare('SELECT * FROM marketing_tests ORDER BY created DESC LIMIT 30').all()};
  if(req.method!=='POST')fail('المسار غير موجود.',404);
  if(url.pathname==='/api/marketing/settings'){
   const c={wabaId:text(b.wabaId,40),phoneId:text(b.phoneId,40),version:text(b.version,12)};
   if(!/^\d{5,40}$/.test(c.wabaId)||!/^\d{5,40}$/.test(c.phoneId)||!/^v\d{1,3}\.0$/.test(c.version))fail('راجع معرّفات ميتا وإصدار Graph API.');
   sql.prepare('INSERT INTO marketing_settings(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(JSON.stringify(c));return {ok:true};
  }
  if(url.pathname==='/api/marketing/check'){const c=config();return {phone:await graph(c.phoneId+'?fields=id,display_phone_number,verified_name')};}
  if(url.pathname==='/api/marketing/templates'){const c=config();const data=await graph(c.wabaId+'/message_templates?fields=id,name,status,language,category,components&limit=100');return {templates:data.data||[],more:!!data.paging?.next};}
  if(url.pathname==='/api/marketing/draft'){
   const kind=b.kind;if(!['template','campaign'].includes(kind))fail('نوع المسودة غير صحيح.');
   const draft={title:text(b.title,100),purpose:['loyalty','general'].includes(b.purpose)?b.purpose:'general',name:text(b.name,80),language:text(b.language,12)||'ar',body:text(b.body,1024),status:'draft'};
   if(kind==='campaign'&&b.audience){const audience={business:text(b.audience.business,80)||'platform',card:text(b.audience.card,80),branch:text(b.audience.branch,80),consent:'opted_in',selected:Array.isArray(b.audience.selected)?b.audience.selected.map(x=>text(x,80)).slice(0,1000):[]};contacts.filtered(audience);draft.audience=audience;}
   if(!draft.title||!draft.body)fail('أدخل العنوان ونص القالب أو الحملة.');
   if(draft.name&&!/^[a-z0-9_]{1,80}$/.test(draft.name))fail('اسم القالب أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط.');
   const id=b.id?text(b.id,50):randomUUID();if(b.id&&!sql.prepare('SELECT id FROM marketing_drafts WHERE id=? AND kind=?').get(id,kind))fail('المسودة غير موجودة.',404);
   sql.prepare('INSERT INTO marketing_drafts(id,kind,json,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,updated=excluded.updated').run(id,kind,JSON.stringify(draft),Date.now());return {ok:true,id};
  }
  if(url.pathname==='/api/marketing/template-submit'){
   if(b.confirm!==true)fail('أكد إرسال القالب للمراجعة.');const row=sql.prepare("SELECT json FROM marketing_drafts WHERE id=? AND kind='template'").get(text(b.id,50));if(!row)fail('القالب غير موجود.',404);const d=JSON.parse(row.json);if(!d.name)fail('أدخل اسم القالب.');if(/\{\{|\}\}/.test(d.body))fail('تجربة الإدارة الأولى تدعم القوالب النصية دون متغيرات؛ استخدم قالبًا ثابتًا للاختبار.');
   const result=await graph(config().wabaId+'/message_templates','POST',{name:d.name,language:d.language,category:'MARKETING',components:[{type:'BODY',text:d.body}]});return {result};
  }
  if(url.pathname==='/api/marketing/test'){
   rate('marketing-test:'+principal.account,5,3600000);
   if(b.confirm!==true||b.consent!==true)fail('أكد رقم التجربة وموافقته على استقبال الرسالة.');const recipient=text(b.recipient,20).replace(/^\+/,'');if(!/^[1-9]\d{7,14}$/.test(recipient))fail('أدخل رقمًا دوليًا صحيحًا.');
   const name=text(b.name,80),language=text(b.language,12);if(!/^[a-z0-9_]{1,80}$/.test(name)||!/^\w{2,12}$/.test(language))fail('اختر قالبًا صحيحًا.');
   const data=await graph(config().wabaId+'/message_templates?fields=name,status,language,components&limit=100');const template=data.data?.find(t=>t.name===name&&t.language===language&&t.status==='APPROVED');if(!template)fail('اختر قالبًا معتمدًا في الحساب المربوط.');
   if(template.components?.some(c=>!['BODY','FOOTER'].includes(c.type)||/\{\{/.test(c.text||'')))fail('الإرسال التجريبي الحالي يدعم القوالب النصية الثابتة فقط.');
   const id=randomUUID();sql.prepare('INSERT INTO marketing_tests(id,recipient,template,status,created) VALUES(?,?,?,?,?)').run(id,recipient,name,'pending',Date.now());
   try{const result=await graph(config().phoneId+'/messages','POST',{messaging_product:'whatsapp',to:recipient,type:'template',template:{name,language:{code:language}}});const messageId=result.messages?.[0]?.id;if(!messageId)fail('لم يصل تأكيد قبول الرسالة.',502);sql.prepare('UPDATE marketing_tests SET status=?,message_id=? WHERE id=?').run('accepted',messageId,id);return {ok:true,status:'accepted',messageId};}catch(e){sql.prepare('UPDATE marketing_tests SET status=? WHERE id=?').run('unconfirmed',id);throw e;}
  }
  fail('المسار غير موجود.',404);
 }
 return {handle};
}
