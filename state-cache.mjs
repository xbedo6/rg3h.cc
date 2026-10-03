import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function createStateStore(sql,dataDir){
 const media=path.join(dataDir,'media');fs.mkdirSync(media,{recursive:true});let cached=null,version=-1;
 const imageKeys=['background','logo','stampImage','stampEmptyImage','rewardImage'];
 function invalidate(){cached=null;version=-1;}
 function load(){const next=sql.prepare('PRAGMA data_version').get().data_version;if(!cached||next!==version){cached=JSON.parse(sql.prepare('SELECT json FROM state WHERE id=1').get().json);version=next;}return cached;}
 function persist(state){for(const shop of state.shops)for(const key of imageKeys){const value=shop.card?.[key],match=typeof value==='string'&&value.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/);if(!match)continue;const bytes=Buffer.from(match[2],'base64'),ext=match[1].startsWith('jp')?'jpg':match[1],id=createHash('sha256').update(bytes).digest('hex')+'.'+ext,file=path.join(media,id);if(!fs.existsSync(file)){const temp=file+'.tmp';fs.writeFileSync(temp,bytes,{mode:0o600});fs.renameSync(temp,file);}shop.card[key]='/media/'+id;}sql.prepare('UPDATE state SET json=? WHERE id=1').run(JSON.stringify(state));cached=state;version=sql.prepare('PRAGMA data_version').get().data_version;}
 function validMedia(value){return /^\/media\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(value)&&fs.existsSync(path.join(media,path.basename(value)));}
 return {load,persist,invalidate,media,validMedia};
}
