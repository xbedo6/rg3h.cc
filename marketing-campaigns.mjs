import {randomUUID} from 'node:crypto';
export function createCampaigns({sql,contacts,fail}){
 sql.exec('CREATE TABLE IF NOT EXISTS marketing_campaign_plans(id TEXT PRIMARY KEY,json TEXT NOT NULL,updated INTEGER NOT NULL)');
 const read=id=>{const row=sql.prepare('SELECT json FROM marketing_campaign_plans WHERE id=?').get(String(id||''));if(!row)fail('الحملة غير موجودة.',404);return {...JSON.parse(row.json),id};};
 const save=d=>{sql.prepare('INSERT INTO marketing_campaign_plans VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,updated=excluded.updated').run(d.id,JSON.stringify(d),Date.now());return d;};
 const list=()=>sql.prepare('SELECT json FROM marketing_campaign_plans ORDER BY updated DESC LIMIT 100').all().map(r=>JSON.parse(r.json));
 function template(id){const row=sql.prepare("SELECT json FROM marketing_drafts WHERE id=? AND kind='template'").get(String(id||''));if(!row)fail('اختر قالبًا محفوظًا.');return {...JSON.parse(row.json),id};}
 function review(d){const t=template(d.templateId),rows=contacts.filtered({...d.audience,consent:'',archived:'no'});if(rows.length>1000)fail('حدد مجموعة أصغر، بحد أقصى 1000 مستلم للحملة.');const recipients=rows.map(c=>({id:c.id,name:c.name,phone:c.phone,status:c.consent==='opted_in'?'ready':'excluded',reason:c.consent==='opted_out'?'أوقف استقبال الرسائل':c.consent!=='opted_in'?'حالة استقبال الرسائل غير مسجلة':'',messageId:'',parameters:d.parameters.map(p=>p==='@name'?(c.name||'عميلنا'):p)}));return {...d,template:{id:t.id,name:t.name,language:t.language,body:t.body,headerType:t.headerType,image:t.image,header:t.header,footer:t.footer,buttons:t.buttons||[],status:t.status},recipients,total:recipients.length,eligible:recipients.filter(r=>r.status==='ready').length,excluded:recipients.filter(r=>r.status==='excluded').length,reviewedAt:Date.now(),status:'reviewed'};}
 async function handle(req,url,b={}){
  if(req.method==='GET')return {campaign:read(url.searchParams.get('id'))};
  const action=url.pathname.split('/').at(-1);
  if(action==='campaign-save'){
   const title=String(b.title||'').trim();if(!title||title.length>100)fail('أدخل اسم حملة حتى 100 حرف.');const t=template(b.templateId),indices=[...new Set([...(t.body||'').matchAll(/\{\{(\d+)\}\}/g)].map(m=>+m[1]))].sort((a,b)=>a-b),parameters=Array.isArray(b.parameters)?b.parameters.map(p=>String(p).trim()):[];if(indices.length!==parameters.length||parameters.some(p=>!p||p.length>1000))fail('أدخل قيمة لكل متغير؛ يمكن اختيار اسم العميل.');
   const a=b.audience||{},audience={business:String(a.business||'platform'),group:String(a.group||''),card:String(a.card||''),branch:String(a.branch||''),selected:Array.isArray(a.selected)?[...new Set(a.selected.map(String))].slice(0,1000):[]};contacts.filtered(audience);if(audience.group&&audience.group!=='ungrouped'){const row=sql.prepare('SELECT json FROM marketing_groups WHERE id=? AND business=?').get(audience.group,audience.business);if(!row||JSON.parse(row.json).archived)fail('اختر مجموعة نشطة تتبع النشاط.');}
   const prior=b.id?read(b.id):null;if(prior&&prior.status==='archived')fail('استعد الحملة قبل تعديلها.');
   const d={id:prior?.id||randomUUID(),title,templateId:t.id,parameters,audience,groupName:audience.group==='ungrouped'?'بدون مجموعة':audience.group?JSON.parse(sql.prepare('SELECT json FROM marketing_groups WHERE id=? AND business=?').get(audience.group,audience.business).json).name:'جميع الأرقام',created:prior?.created||Date.now(),status:'draft',recipients:[]};return {campaign:save(d)};
  }
  const d=read(b.id);
  if(action==='campaign-review'){if(d.status==='archived')fail('الحملة مؤرشفة.');return {campaign:save(review(d))};}
  if(action==='campaign-archive')return {campaign:save({...d,status:b.archived===false?(d.reviewedAt?'reviewed':'draft'):'archived'})};
  if(action==='campaign-send')fail('الإرسال الفعلي مغلق حتى إكمال ربط ميتا والتحقق من متابعة التسليم. لم تُرسل أي رسالة.',409);
  fail('المسار غير موجود.',404);
 }
 return {handle,list};
}
