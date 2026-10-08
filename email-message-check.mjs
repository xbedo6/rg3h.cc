import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createMailer} from './mail.mjs';
import {buildVerificationMessage,verificationContent} from './email-message.mjs';

const calls=[],originalFetch=globalThis.fetch;
const env={...process.env};
Object.assign(process.env,{NODE_ENV:'test',EMAIL_PROVIDER:'gmail-api',ADMIN_EMAIL:'sender@example.com',GMAIL_CLIENT_ID:'test-client',GMAIL_CLIENT_SECRET:'test-secret',GMAIL_REFRESH_TOKEN:'test-refresh'});
delete process.env.GMAIL_SENDER;
globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('oauth2')?{access_token:'fake-access'}:{id:'fake-message'}};};
const sql=new DatabaseSync(':memory:');
const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
try{
  const mailer=createMailer({sql,origin:'https://rg3h.cc',fail});
  assert(mailer.ready());
  const output=path.resolve('../output/email-fix');await fs.mkdir(output,{recursive:true});
  for(const purpose of ['register','reset','admin']){
    await mailer.send('customer@example.com','012345',purpose);
    const payload=JSON.parse(calls.at(-1).options.body);
    const mime=Buffer.from(payload.raw,'base64url').toString('utf8');
    assert(!mime.includes('\\r\\n'),'MIME must not contain literal escape sequences');
    assert(mime.includes('\r\n\r\n'),'Headers and body need a real blank line');
    assert(!/(?<!\r)\n/.test(mime),'Use CRLF throughout MIME');
    assert.match(mime,/^From: =\?UTF-8\?B\?.+\?= <sender@example.com>\r\nTo: customer@example.com\r\n/);
    assert.match(mime,/Date: .+GMT\r\nMessage-ID: <.+@example.com>/);
    assert.match(mime,/Content-Type: multipart\/related;/);
    assert.match(mime,/Content-Type: text\/plain; charset=UTF-8/);
    assert.match(mime,/Content-Type: text\/html; charset=UTF-8/);
    assert.match(mime,/Content-ID: <rg3h-logo>/);
    for(const word of mime.match(/=\?UTF-8\?B\?.+?\?=/g)||[])assert(word.length<=75,'Encoded header words must fit RFC 2047');
    assert(Buffer.byteLength(mime)<100000,'Keep email light');
    await fs.writeFile(path.join(output,purpose+'.eml'),mime);
  }
  const content=verificationContent('012345','register');
  assert.match(content.html,/cid:rg3h-logo/);
  assert(!content.html.includes('src="https://'),'Logo is embedded rather than tracked or fetched');
  assert.match(content.text,/012345/);
  assert.match(content.subject,/تأكيد بريد حسابك الجديد/);
  assert.match(verificationContent('012345','reset').subject,/استعادة الحساب/);
  assert.throws(()=>buildVerificationMessage({sender:'sender@example.com\r\nBcc: other@example.com',to:'customer@example.com',code:'012345'}));
  assert.throws(()=>buildVerificationMessage({sender:'sender@example.com',to:'bad\r\n@example.com',code:'012345'}));
  assert.throws(()=>verificationContent('<img>','register'));
  assert.match(verificationContent('012345','register',false).html,/>رجعة<\/span>/);
  const sendCall=calls.find(c=>c.url.includes('gmail.googleapis.com'));
  assert.equal(sendCall.options.headers.Authorization,'Bearer fake-access');
  assert.equal(calls.length,6);
  console.log('PASS: actual mail transport, standards-compliant MIME, Arabic subjects, plain-text alternative, inline PNG, small payload, CRLF and injection defenses. No email was sent.');
}finally{
  globalThis.fetch=originalFetch;sql.close();
  for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];
  Object.assign(process.env,env);
}
