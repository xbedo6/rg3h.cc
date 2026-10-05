import fs from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const hmac=(key,value)=>createHmac('sha256',key).update(value).digest();
export function remoteBackupConfig(env=process.env){const keys=['BACKUP_S3_ENDPOINT','BACKUP_S3_BUCKET','BACKUP_S3_ACCESS_KEY_ID','BACKUP_S3_SECRET_ACCESS_KEY'];return {configured:keys.every(k=>!!env[k]),missing:keys.filter(k=>!env[k])};}
export async function uploadEncryptedBackup(file,name,{env=process.env,fetcher=fetch,at=new Date()}={}){
  if(!remoteBackupConfig(env).configured)throw Error('backup_remote_not_configured');
  const bytes=fs.readFileSync(file);if(bytes.subarray(0,8).toString()!=='RG3HENC1')throw Error('backup_remote_requires_encryption');
  const endpoint=new URL(env.BACKUP_S3_ENDPOINT);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('backup_remote_invalid_endpoint');
  const bucket=env.BACKUP_S3_BUCKET;if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))throw Error('backup_remote_invalid_bucket');
  const prefix=(env.BACKUP_S3_PREFIX||'rg3h').split('/').filter(Boolean);if(prefix.some(x=>!/^[-a-zA-Z0-9_]+$/.test(x)))throw Error('backup_remote_invalid_prefix');
  if(!/^backup-\d+\.rgbackup$/.test(name))throw Error('backup_remote_invalid_name');
  const path=[...endpoint.pathname.split('/').filter(Boolean),bucket,...prefix,name].map(encodeURIComponent).join('/');endpoint.pathname='/'+path;
  const timestamp=at.toISOString().replace(/[-:]|\.\d{3}/g,''),day=timestamp.slice(0,8),region=env.BACKUP_S3_REGION||'auto',scope=`${day}/${region}/s3/aws4_request`,payloadHash=sha(bytes);
  const headers={host:endpoint.host,'x-amz-content-sha256':payloadHash,'x-amz-date':timestamp};if(env.BACKUP_S3_SESSION_TOKEN)headers['x-amz-security-token']=env.BACKUP_S3_SESSION_TOKEN;
  const signed=Object.keys(headers).sort(),canonicalHeaders=signed.map(k=>`${k}:${headers[k]}\n`).join('');
  const canonical=['PUT',endpoint.pathname,'',canonicalHeaders,signed.join(';'),payloadHash].join('\n');
  const key=hmac(hmac(hmac(hmac('AWS4'+env.BACKUP_S3_SECRET_ACCESS_KEY,day),region),'s3'),'aws4_request'),signature=createHmac('sha256',key).update(`AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${sha(canonical)}`).digest('hex');
  headers.Authorization=`AWS4-HMAC-SHA256 Credential=${env.BACKUP_S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${signature}`;
  const r=await fetcher(endpoint,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes,redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error('backup_remote_upload_failed');
  return {created:Date.now(),name,bytes:bytes.length,verified:'provider-accepted'};
}
