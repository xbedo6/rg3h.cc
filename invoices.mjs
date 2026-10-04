import {randomUUID} from 'node:crypto';
import Plans from './dist/plans.js';

export function createInvoices({load,fail,audit,extend,now=()=>Date.now()}) {
 const clean=(v,n)=>String(v||'').trim().slice(0,n);
 function issue(s,actor,a,b={}) {
  s.invoices??=[];
  const key=clean(b.requestId,100);
  if(key){const prior=s.invoices.find(i=>i.requestId===key);if(prior){if(prior.account!==a.id)fail('معرّف إصدار مكرر.',409);return prior;}}
  const plan=b.plan||a.subscription?.plan||'growth',tier=Plans.plans[plan],period=b.period;
  if(!tier||!['month','year'].includes(period))fail('اختر الباقة والمدة الصحيحة.');
  const amount=b.amount===undefined?(period==='year'?tier.annual:tier.sale):Number(b.amount);
  if(!Number.isFinite(amount)||amount<0||amount>1000000||Math.abs(amount*100-Math.round(amount*100))>0.00001)fail('المبلغ غير صحيح؛ استخدم منزلتين عشريتين كحد أقصى.');
  const time=now(),start=b.start===undefined?time:Number(b.start);
  if(!Number.isFinite(start)||start<946684800000||start>4102444800000)fail('تاريخ بداية الفترة غير صحيح.');
  const end=b.end===undefined?extend(start,period):Number(b.end);
  if(!Number.isFinite(end)||end<=start||end>4102444800000)fail('تاريخ نهاية الفترة غير صحيح.');
  s.invoiceSequence=(s.invoiceSequence||s.invoices.length)+1;
  const sh=s.shops.find(x=>x.id===a.shop);
  const invoice={id:randomUUID(),number:'RJ-INV-'+String(s.invoiceSequence).padStart(6,'0'),account:a.id,customer:clean(a.name,80),business:clean(sh?.name,80),email:clean(a.email,254),plan,planName:tier.name,period,amountCents:Math.round(amount*100),currency:'SAR',start,end,created:time,status:b.paid===true?'paid':'issued',paidAt:b.paid===true?time:null,notes:clean(b.notes,500),source:b.source||'manual',requestId:key};
  s.invoices.unshift(invoice);audit(s,actor,'إصدار فاتورة',a,invoice.number);return invoice;
 }
 function command(s,principal,b){
  if(principal?.kind!=='admin')fail('الفواتير مخصصة للإدارة.',403);
  const actor=principal.account||principal.email||principal.phone||'admin';
  if(b.action==='invoice-create'){
   const a=s.accounts.find(x=>x.id===b.account);if(!a)fail('الحساب غير موجود.',404);
   if(!/^[a-zA-Z0-9-]{16,100}$/.test(b.requestId||''))fail('معرّف الإصدار مطلوب.');
   return {invoice:issue(s,actor,a,b)};
  }
  const i=s.invoices?.find(x=>x.id===b.id);if(!i)fail('الفاتورة غير موجودة.',404);
  if(b.action==='invoice-paid'){
   if(i.status==='cancelled')fail('الفاتورة ملغاة.');
   if(i.status!=='paid'){i.status='paid';i.paidAt=now();audit(s,actor,'اعتماد سداد فاتورة',s.accounts.find(a=>a.id===i.account),i.number);}
  }else if(b.action==='invoice-cancel'){
   if(i.status==='paid')fail('لا يمكن إلغاء فاتورة مدفوعة من هذا المسار.');
   const reason=clean(b.reason,300);if(!reason)fail('اكتب سبب الإلغاء.');
   if(i.status!=='cancelled'){i.status='cancelled';i.cancelledAt=now();i.cancelReason=reason;audit(s,actor,'إلغاء فاتورة',s.accounts.find(a=>a.id===i.account),i.number+' · '+reason);}
  }else fail('إجراء غير مسموح.',403);
  return {invoice:i};
 }
 function read(principal,url){
  if(principal?.kind!=='admin')fail('الفواتير مخصصة للإدارة.',403);
  const s=load(),all=s.invoices||[],id=url.searchParams.get('id');
  if(id){const invoice=all.find(i=>i.id===id);if(!invoice)fail('الفاتورة غير موجودة.',404);return {invoice};}
  const account=url.searchParams.get('account')||'',status=url.searchParams.get('status')||'',q=clean(url.searchParams.get('q'),120).toLowerCase();
  const rows=all.filter(i=>(!account||i.account===account)&&(!status||i.status===status)&&(!q||[i.number,i.customer,i.business].some(x=>x.toLowerCase().includes(q))));
  const offset=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0)));
  return {invoices:rows.slice(offset,offset+50),total:rows.length,summary:{paidCents:rows.filter(i=>i.status==='paid').reduce((n,i)=>n+i.amountCents,0),dueCents:rows.filter(i=>i.status==='issued').reduce((n,i)=>n+i.amountCents,0)}};
 }
 return {issue,command,read};
}
