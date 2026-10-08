import {randomUUID} from 'node:crypto';

const CRLF='\r\n';
const b64=value=>Buffer.from(value).toString('base64').match(/.{1,76}/g)?.join(CRLF)||'';
function encodedHeader(value){
  const chunks=[];let chunk='';
  for(const char of value){if(Buffer.byteLength(chunk+char)>42){chunks.push(chunk);chunk='';}chunk+=char;}
  if(chunk)chunks.push(chunk);
  return chunks.map(part=>'=?UTF-8?B?'+Buffer.from(part).toString('base64')+'?=').join(CRLF+' ');
}
function address(value){
  const email=String(value||'').trim();
  if(email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email))throw Error('Invalid email address');
  return email;
}

export function verificationContent(code,purpose,hasLogo=true){
  if(!/^\d{6}$/.test(String(code)))throw Error('Invalid verification code');
  const action=purpose==='reset'?'استعادة الحساب':purpose==='register'?'تأكيد بريد حسابك الجديد':'تسجيل الدخول';
  const subject='رجعة | رمز '+action;
  const text=`رجعة\n\nرمز ${action}: ${code}\n\nأدخل الرمز في صفحة رجعة التي طلبته منها. الرمز صالح لمدة 10 دقائق، ويُستخدم مرة واحدة فقط.\nلا تشارك الرمز مع أي شخص. إذا لم تطلبه، تجاهل هذه الرسالة.\n\nفريق رجعة — rg3h.cc`;
  const logo=hasLogo?'<img src="cid:rg3h-logo" width="220" height="85" alt="رجعة" style="display:block;width:220px;max-width:100%;height:auto;border:0;margin:0 auto">':'<span style="font-size:28px;font-weight:bold;color:#153c32">رجعة</span>';
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body dir="rtl" style="margin:0;padding:0;background:#edf3ef;color:#153c32;font-family:Tahoma,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf3ef"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #d9e5dd;border-radius:16px"><tr><td align="center" bgcolor="#ffffff" style="padding:28px 24px 12px;background:#ffffff">${logo}</td></tr><tr><td align="right" style="padding:20px 28px 28px;direction:rtl;text-align:right"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.6;color:#153c32">رمز ${action}</h1><p style="margin:0 0 20px;font-size:16px;line-height:1.8">أدخل الرمز التالي في صفحة رجعة لإكمال ${action}.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td dir="ltr" align="center" bgcolor="#f0f5f1" style="padding:18px 8px;background:#f0f5f1;border:1px solid #d9e5dd;border-radius:12px;color:#153c32;font-family:Arial,sans-serif;font-size:34px;font-weight:bold;letter-spacing:6px;line-height:1.4">${code}</td></tr></table><p style="margin:20px 0 8px;font-size:14px;line-height:1.8">صالح لمدة <strong>10 دقائق</strong>، ويُستخدم مرة واحدة فقط.</p><p style="margin:0 0 20px;font-size:14px;line-height:1.8">لا تشارك الرمز مع أي شخص. إذا لم تطلبه، تجاهل هذه الرسالة.</p><p style="margin:0;padding-top:18px;border-top:1px solid #e2ebe5;font-size:13px;color:#566b60;line-height:1.8">فريق رجعة<br><span dir="ltr">rg3h.cc</span></p></td></tr></table></td></tr></table></body></html>`;
  return {subject,text,html};
}

export function buildVerificationMessage({sender,to,code,purpose,logo,date=new Date()}){
  sender=address(sender);to=address(to);
  const {subject,text,html}=verificationContent(code,purpose,!!logo?.length);
  const alternative='rg3h-alt-'+randomUUID(),related='rg3h-related-'+randomUUID();
  const headers=[`From: ${encodedHeader('رجعة')} <${sender}>`,`To: ${to}`,`Subject: ${encodedHeader(subject)}`,`Date: ${date.toUTCString()}`,`Message-ID: <${randomUUID()}@${sender.split('@')[1]}>`,'MIME-Version: 1.0',`Content-Type: multipart/related; boundary="${related}"; type="multipart/alternative"`];
  const parts=[...headers,'',`--${related}`,`Content-Type: multipart/alternative; boundary="${alternative}"`,'',`--${alternative}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(text),`--${alternative}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(html),`--${alternative}--`];
  if(logo?.length)parts.push(`--${related}`,'Content-Type: image/png; name="rg3h-logo.png"','Content-Transfer-Encoding: base64','Content-ID: <rg3h-logo>','Content-Disposition: inline; filename="rg3h-logo.png"','',b64(logo));
  parts.push(`--${related}--`,'');
  return parts.join(CRLF);
}
