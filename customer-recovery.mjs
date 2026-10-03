import {randomBytes} from 'node:crypto';

export function createCustomerRecovery({sql,load,hash,rate,fail,phone,status,accountFor,authorized,staffAllows,origin}) {
  sql.exec(`CREATE TABLE IF NOT EXISTS customer_recovery(token_hash TEXT PRIMARY KEY,shop TEXT NOT NULL,member TEXT NOT NULL,issuer TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);`);
  function issue(principal,b) {
    if(!['owner','employee'].includes(principal.kind)) fail('استرجاع البطاقة متاح لصاحب النشاط والموظف المخول فقط.',403);
    rate('recovery-issue:'+hash(JSON.stringify(principal)),10,600000);
    if(b.ownershipConfirmed!==true) fail('تحقق من هوية العميل وملكية رقمه قبل إصدار رابط الاستعادة.');
    const s=load(),base=authorized(s,principal,true),sh=s.shops.find(x=>x.id===b.shop);
    if(!sh||sh.archivedAt||(sh.business||sh.id)!==(base.business||base.id)) fail('البطاقة غير متاحة لهذا الحساب.',403);
    authorized(s,{...principal,shop:sh.id},true);
    if(principal.kind==='employee'&&!staffAllows(s,principal,sh)) fail('هذه البطاقة غير مخصصة لك.',403);
    const p=phone(b.phone),member=sh.members.find(m=>m.phone===p);
    if(!member) fail('لا توجد بطاقة بهذا الرقم في البرنامج المحدد.',404);
    const token=randomBytes(32).toString('hex'),expires=Date.now()+600000;
    sql.exec('BEGIN IMMEDIATE');
    try {
      sql.prepare('DELETE FROM customer_recovery WHERE expires<? OR (shop=? AND member=?)').run(Date.now(),sh.id,member.id);
      sql.prepare('INSERT INTO customer_recovery VALUES(?,?,?,?,?,0)').run(hash(token),sh.id,member.id,JSON.stringify({kind:principal.kind,id:principal.employee||principal.account}),expires);
      sql.prepare('INSERT INTO recovery_audit(shop,member,issuer_kind,issuer_id,event,time) VALUES(?,?,?,?,?,?)').run(sh.id,member.id,principal.kind,principal.employee||principal.account,'issued',Date.now());
      sql.exec('COMMIT');
    } catch(e) {sql.exec('ROLLBACK');throw e;}
    return {url:origin+'/?recover=1#'+token,expires,name:member.name};
  }
  function consume(b,ip) {
    rate('recovery-consume:'+ip,20,600000);
    if(!/^[a-f0-9]{64}$/.test(String(b.token||''))) fail('رابط الاستعادة غير صالح أو منتهٍ.');
    const tokenHash=hash(b.token);
    sql.exec('BEGIN IMMEDIATE');
    try {
      const row=sql.prepare('SELECT * FROM customer_recovery WHERE token_hash=? AND used=0 AND expires>?').get(tokenHash,Date.now()),s=load(),sh=row&&s.shops.find(x=>x.id===row.shop),member=sh?.members.find(x=>x.id===row.member);
      if(!row||!member||sh.archivedAt||sh.status!=='active'||status(accountFor(s,sh))!=='active') fail('رابط الاستعادة غير صالح أو منتهٍ.');
      const issuer=JSON.parse(row.issuer),business=s.shops.find(x=>x.id===(sh.business||sh.id));
      if(issuer.kind==='employee'&&(!business.employees.some(e=>e.id===issuer.id&&e.status==='active')||!staffAllows(s,{kind:'employee',employee:issuer.id},sh))) fail('رابط الاستعادة غير صالح أو منتهٍ.');
      if(!sql.prepare('UPDATE customer_recovery SET used=1 WHERE token_hash=? AND used=0').run(tokenHash).changes) fail('رابط الاستعادة غير صالح أو منتهٍ.');
      for(const session of sql.prepare('SELECT hash,principal FROM sessions').all()) {
        const p=JSON.parse(session.principal);
        if(p.kind==='customer'&&p.shop===sh.id&&p.member===member.id) sql.prepare('DELETE FROM sessions WHERE hash=?').run(session.hash);
      }
      const principal={kind:'customer',shop:sh.id,member:member.id},token=randomBytes(32).toString('hex');
      sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),JSON.stringify(principal),Date.now()+365*86400000);
      sql.prepare('INSERT INTO recovery_audit(shop,member,issuer_kind,issuer_id,event,time) VALUES(?,?,?,?,?,?)').run(sh.id,member.id,issuer.kind,issuer.id,'consumed',Date.now());
      sql.exec('COMMIT');return {principal,token};
    } catch(e) {sql.exec('ROLLBACK');throw e;}
  }
  return {issue,consume};
}
