import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {spawnSync} from 'node:child_process';import {createStateStore} from './state-cache.mjs';import {createOperations} from './operations.mjs';
const root=fs.mkdtempSync(path.resolve('release-check-')),sql=new DatabaseSync(path.join(root,'rijaa.sqlite'));
sql.exec('PRAGMA journal_mode=WAL; CREATE TABLE state(id INTEGER PRIMARY KEY,json TEXT); CREATE TABLE support_test(id INTEGER PRIMARY KEY,message TEXT);');
sql.prepare('INSERT INTO support_test VALUES(1,?)').run('private support');
const image=Buffer.from('saved-image-data'),state={shops:[{id:'test',card:{logo:'data:image/png;base64,'+image.toString('base64')},members:[{id:'client',visits:2}]}],accounts:[]};
sql.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(state));const store=createStateStore(sql,root);
sql.exec('BEGIN IMMEDIATE');store.persist(structuredClone(store.load()));sql.exec('COMMIT');
const asset=store.load().shops[0].card.logo;assert(store.validMedia(asset));assert.deepEqual(fs.readFileSync(path.join(root,asset.slice(1))),image);
sql.exec('BEGIN');const altered=structuredClone(store.load());altered.shops[0].members[0].visits=99;store.persist(altered);sql.exec('ROLLBACK');store.invalidate();assert.equal(store.load().shops[0].members[0].visits,2);
const external=new DatabaseSync(path.join(root,'rijaa.sqlite'));const updated=structuredClone(store.load());updated.shops[0].members[0].visits=3;external.prepare('UPDATE state SET json=?').run(JSON.stringify(updated));external.close();assert.equal(store.load().shops[0].members[0].visits,3);
const ops=createOperations({sql,dataDir:root,fail:(message,status)=>{throw Object.assign(Error(message),{status});}});
await assert.rejects(ops.handle({method:'GET'},{},new URL('http://local/api/operations/status'),{kind:'owner'}),{status:403});
for(const encrypted of [false,true]){
 process.env.BACKUP_ENCRYPTION_KEY=encrypted?'ab'.repeat(32):'';
 const backup=await ops.backup();assert.equal(backup.integrity,'ok');const source=path.join(root,'backups',backup.name),dest=path.join(root,encrypted?'encrypted-restore':'plain-restore');
 const result=spawnSync(process.execPath,['restore-backup.mjs',source,dest],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const restored=new DatabaseSync(path.join(dest,'rijaa.sqlite'));assert.equal(JSON.parse(restored.prepare('SELECT json FROM state').get().json).shops[0].members[0].visits,3);assert.equal(restored.prepare('SELECT message FROM support_test').get().message,'private support');restored.close();assert.deepEqual(fs.readFileSync(path.join(dest,asset.slice(1))),image);
 assert.notEqual(spawnSync(process.execPath,['restore-backup.mjs',source,dest]).status,0);
 if(encrypted)assert.notEqual(spawnSync(process.execPath,['restore-backup.mjs',source,path.join(root,'wrong-key')],{env:{...process.env,BACKUP_ENCRYPTION_KEY:'cd'.repeat(32)}}).status,0);
}
sql.close();console.log('PASS: media round trip, transaction rollback, external cache invalidation, admin-only operations, plain/encrypted backup restore, support data and balances preserved, occupied destination and wrong key rejected.');process.exit(0);
