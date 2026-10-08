import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {walletFields,WALLET_LAYOUT_VERSION} from './wallet-fields.mjs';
import {createWallet} from './wallet.mjs';
import {walletImages} from './wallet-images.mjs';
const designs=JSON.parse(fs.readFileSync('dist/showcase-designs.json'));
for(const card of [...designs,{name:'بدون شعار',target:4,type:'visits',reward:'قهوة مجانية'}]){
 for(const language of ['ar','en'])for(const count of [0,2,4]){
  const fields=walletFields({...card,cardLanguage:language},{stamps:count,points:count*20,rewards:0});
  assert.deepEqual(fields.primaryFields,[{label:'',value:''}]);
  assert.equal(fields.secondaryFields.length,1);
  assert.deepEqual(fields.secondaryFields,fields.footerFields);
  assert.equal(fields.headerFields.length,1);
  assert(fields.headerFields[0].changeMessage.includes('%@'));
  assert(/^\d+$/.test(fields.rewardAvailability.value));
 }
}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rg3h-wallet-compatible-')),sql=new DatabaseSync(':memory:'),calls=[];
sql.exec("CREATE TABLE wallet_layout_versions(version TEXT PRIMARY KEY); INSERT INTO wallet_layout_versions VALUES('apple-poster-v2'); CREATE TABLE wallet_passes(shop TEXT,member TEXT,serial TEXT,google_url TEXT,share_url TEXT,apple BLOB,payload_hash TEXT,status TEXT DEFAULT 'ready',dirty INTEGER DEFAULT 0,attempts INTEGER DEFAULT 0,next_attempt INTEGER DEFAULT 0,last_error TEXT,updated INTEGER,PRIMARY KEY(shop,member));");
for(const [shop,member,serial] of [['shop-a','RJ-A','serial-a'],['shop-b','RJ-B','serial-b'],['paused','RJ-P','serial-p'],['shop-a','DEMO-WALLET-shop-a','serial-demo']])sql.prepare('INSERT INTO wallet_passes(shop,member,serial,payload_hash) VALUES(?,?,?,?)').run(shop,member,serial,'old-layout');
const shops=['shop-a','shop-b','paused'].map((id,i)=>({id,status:id==='paused'?'paused':'active',card:designs[i],members:[{id:i===0?'RJ-A':i===1?'RJ-B':'RJ-P',stamps:2,points:20,rewards:0}]}));
let reject=true;
const options={sql,dataDir:root,origin:'https://rg3h.cc',load:()=>({shops}),authorized:()=>shops[0],status:()=> 'active',accountFor:()=>({}),rate(){},fail(message,status){throw Object.assign(Error(message),{status})},request:async(url,opt)=>{calls.push({url,method:opt.method,body:JSON.parse(opt.body)});return {ok:!reject,status:reject?400:200,json:async()=>({serialNumber:'new-serial',applePass:Buffer.from('PK-test').toString('base64'),googleSaveUrl:'https://pay.google.com/gp/v/save/test'})};}};
process.env.WALLETWALLET_API_KEY='ww_live_'+'0'.repeat(32);
const wallet=createWallet(options);
assert.equal(sql.prepare('SELECT sum(dirty) n FROM wallet_passes').get().n,0,'startup must not bulk-submit an unvalidated layout');
await assert.rejects(wallet.sync(shops[0],{id:'DEMO-WALLET-shop-a',stamps:2,points:20,rewards:0},true));
assert.equal(sql.prepare('SELECT version FROM wallet_layout_versions WHERE version=?').get(WALLET_LAYOUT_VERSION),undefined,'provider rejection must not queue customer passes');
reject=false;
await wallet.sync(shops[0],{id:'DEMO-WALLET-shop-a',stamps:2,points:20,rewards:0},true);
assert.equal(sql.prepare("SELECT count(*) n FROM wallet_passes WHERE dirty=1 AND member NOT LIKE 'DEMO-WALLET-%'").get().n,3);
assert.equal(sql.prepare("SELECT dirty FROM wallet_passes WHERE member LIKE 'DEMO-WALLET-%'").get().dirty,0);
createWallet(options);
assert.equal(sql.prepare('SELECT max(dirty) n FROM wallet_passes').get().n,1,'restarting must not repeat migration');
await wallet.drain();
assert.equal(sql.prepare('SELECT count(*) n FROM wallet_passes WHERE dirty>0').get().n,0);
assert.equal(sql.prepare("SELECT status FROM wallet_passes WHERE shop='paused'").get().status,'suspended');
const accepted=calls.slice(1);
assert(accepted.every(x=>x.method==='PUT'),'all existing passes must retain their serial');
assert.equal(calls.filter(x=>x.url.endsWith('/serial-a')).length,1);
assert.equal(calls.filter(x=>x.url.endsWith('/serial-b')).length,1);
assert.equal(calls.filter(x=>x.url.endsWith('/serial-p')).length,0);
for(const [i,url] of [[0,'serial-a'],[1,'serial-b']]){
 const body=calls.find(x=>x.url.endsWith('/'+url)).body,images=await walletImages(shops[i].card,shops[i].members[0],root);
 assert.equal(body.backgroundURL,images.backgroundURL,'modern artwork must not change');
 assert.equal(body.stripURL,images.stripURL,'classic artwork must not change');
 assert.equal(body.logoURL,images.logoURL,'logo must not change');
}
const count=calls.length;await wallet.drain();assert.equal(calls.length,count,'completed migration must not consume repeated updates');
const fresh={id:'RJ-NEW',stamps:0,points:0,rewards:0};await wallet.sync(shops[0],fresh);
assert.equal(calls.at(-1).method,'POST');assert.deepEqual(calls.at(-1).body.primaryFields,[{label:'',value:''}]);assert.deepEqual(calls.at(-1).body.secondaryFields,calls.at(-1).body.footerFields,'future cards must use the same compatible layout automatically');
sql.close();
console.log('PASS: Arabic/English reward fields, unchanged modern artwork/logo, provider-gated one-time migration, same serials, suspended accounts excluded, future cards compatible, no repeated quota use.');
