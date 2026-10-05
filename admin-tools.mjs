import {randomUUID} from 'node:crypto';
export function createAdminTools({sql,load,fail,validateCard}) {
  sql.exec('CREATE TABLE IF NOT EXISTS platform_templates(id TEXT PRIMARY KEY,title TEXT NOT NULL,card TEXT NOT NULL,version INTEGER NOT NULL,archived INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS platform_template_events(id TEXT PRIMARY KEY,time INTEGER NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,title TEXT NOT NULL);');
  const seeds=[['coffee','قالب الكافيه','coffee',4,'قهوة مجانية'],['car','قالب مغسلة السيارات','car',4,'غسلة مجانية'],['shop','قالب المتجر','bag',6,'خصم ٥٠ ريالًا'],['salon','قالب الصالون','scissors',5,'خدمة مجانية']];
  for(const [id,title,icon,target,reward] of seeds)sql.prepare('INSERT OR IGNORE INTO platform_templates VALUES(?,?,?,1,0,?)').run('base-'+id,title,JSON.stringify({name:title,category:title,icon,color:'#204b3c',accent:'#e7efcf',target,reward,logo:'',programType:'visits',terms:'زيارة لكل عملية شراء مؤهلة. تحدد شروط النشاط تفاصيل المكافأة.'}),Date.now());
  const safeCard=raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('بيانات القالب غير صحيحة.');const card={};for(const key of ['name','category','reward','terms','color','accent','icon','target','programType','discountType','discountValue','pointsPerVisit','pointsCost'])if(raw[key]!==undefined)card[key]=raw[key];for(const key of ['name','category','reward','terms'])if(typeof card[key]!=='string'||card[key].length>(key==='terms'?1500:120))fail('راجع النصوص وحدود القالب.');for(const key of ['color','accent'])if(!/^#[a-f0-9]{6}$/i.test(card[key]||''))fail('اختر ألوانًا صحيحة.');if(!['coffee','car','bag','scissors','star','heart'].includes(card.icon))fail('اختر رمزًا صحيحًا.');try{validateCard(card);}catch(e){fail(e.message);}return card;};
  function readTemplates(archived=false){return sql.prepare('SELECT * FROM platform_templates WHERE archived=? ORDER BY updated DESC,id').all(archived?1:0).map(x=>({...x,card:JSON.parse(x.card)}));}
  async function handle(req,url,principal,b={}) {
    if(principal?.kind!=='admin')fail('هذه الأدوات مخصصة للإدارة.',403);
    if(url.pathname==='/api/admin/templates'){
      if(req.method==='GET')return {templates:readTemplates(url.searchParams.get('archived')==='1')};
      if(req.method!=='POST')fail('طريقة الطلب غير متاحة.',405);
      const title=String(b.title||'').trim();const row=b.id?sql.prepare('SELECT * FROM platform_templates WHERE id=?').get(b.id):null;
      if(b.id&&!row)fail('القالب غير موجود.',404);
      if(row&&Number(b.version)!==row.version)fail('تم تحديث القالب في جلسة أخرى. حدّث القائمة أولًا.',409);
      if(b.action==='archive'||b.action==='restore'){if(!row)fail('اختر القالب.');sql.prepare('UPDATE platform_templates SET archived=?,version=version+1,updated=? WHERE id=? AND version=?').run(b.action==='archive'?1:0,Date.now(),row.id,row.version);}
      else if(b.action==='save'){if(!title||title.length>80)fail('أدخل عنوانًا حتى ٨٠ حرفًا.');const card=safeCard(b.card);if(row)sql.prepare('UPDATE platform_templates SET title=?,card=?,version=version+1,updated=? WHERE id=? AND version=?').run(title,JSON.stringify(card),Date.now(),row.id,row.version);else sql.prepare('INSERT INTO platform_templates VALUES(?,?,?,1,0,?)').run(randomUUID(),title,JSON.stringify(card),Date.now());}
      else fail('الإجراء غير متاح.');
      sql.prepare('INSERT INTO platform_template_events VALUES(?,?,?,?,?)').run(randomUUID(),Date.now(),principal.email||principal.account||principal.phone||'الإدارة',b.action==='archive'?'أرشفة قالب':b.action==='restore'?'استعادة قالب':row?'تعديل قالب':'إضافة قالب',title||row?.title||'قالب');
      return {ok:true,templates:readTemplates()};
    }
    if(req.method==='GET'&&url.pathname==='/api/admin/logs'){
      const s=load(),mode=url.searchParams.get('kind')==='audit'?'audit':'operations';
      const accounts=new Map(s.accounts.map(a=>[a.shop,a]));const shops=new Map(s.shops.map(sh=>[sh.id,sh]));
      const translate={year:'سنة',month:'شهر','save-card':'تعديل بطاقة','create-program':'إنشاء بطاقة','delete-program':'أرشفة بطاقة','restore-program':'استعادة بطاقة','create-branch':'إضافة فرع','update-branch':'تعديل فرع','add-employee':'إضافة موظف'};
      let rows=mode==='audit'?s.adminLogs.map(l=>({...l,caption:l.action,detail:translate[l.extra]||l.extra||'',actor:l.actor||'غير مسجل',account:s.accounts.find(a=>a.name===l.user)?.id||'',shopName:l.user})):s.shops.flatMap(sh=>(sh.logs||[]).map(l=>({...l,shop:sh.id,branch:l.branchId||l.branch||'',account:accounts.get(sh.business||sh.id)?.id||'',shopName:sh.name,actor:l.employee||'غير مسجل',caption:l.type==='redeem'?'صرف مكافأة':l.type==='undo'?'تراجع عن عملية':l.type==='reward'?'استحقاق مكافأة':l.programType==='points'?'إضافة نقاط':'إضافة زيارة',branchName:l.branchName||(shops.get(sh.business||sh.id)?.branches||[]).find(x=>x.id===(l.branchId||l.branch))?.name||'بدون فرع'})));
      if(mode==='audit')rows.push(...sql.prepare('SELECT * FROM platform_template_events').all().map(l=>({...l,user:'قوالب المنصة',caption:l.action,detail:l.title,account:'',shopName:'قوالب المنصة'})));
      const q=(url.searchParams.get('q')||'').trim().toLowerCase(),account=url.searchParams.get('account'),shop=url.searchParams.get('shop'),branch=url.searchParams.get('branch'),actor=url.searchParams.get('actor');
      const dateLimit=(v,end)=>{if(!v)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('التاريخ غير صحيح.');const n=Date.parse(v+(end?'T23:59:59.999+03:00':'T00:00:00+03:00'));if(!Number.isFinite(n))fail('التاريخ غير صحيح.');return n;};const from=dateLimit(url.searchParams.get('from'),false),to=dateLimit(url.searchParams.get('to'),true);if(from!==null&&to!==null&&from>to)fail('تاريخ البداية بعد النهاية.');
      rows=rows.filter(l=>(!account||l.account===account)&&(!shop||l.shop===shop)&&(!branch||l.branch===branch)&&(!actor||String(l.actor).toLowerCase().includes(actor.toLowerCase()))&&(from===null||l.time>=from)&&(to===null||l.time<=to)&&(!q||[l.name,l.user,l.shopName,l.caption,l.detail,l.actor,l.member,l.id].join(' ').toLowerCase().includes(q))).sort((a,b)=>b.time-a.time||String(a.id).localeCompare(String(b.id)));
      const pageSize=50,total=rows.length,page=Math.min(Math.max(1,Math.floor(Number(url.searchParams.get('page'))||1)),Math.max(1,Math.ceil(total/pageSize)));
      return {rows:rows.slice((page-1)*pageSize,page*pageSize),total,page,pageSize};
    }
    fail('المسار غير موجود.',404);
  }
  return {handle};
}
