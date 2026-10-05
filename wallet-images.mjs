import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Loyalty=require('./dist/loyalty.js'),WalletLayout=require('./dist/wallet-layout.js');
let engine;async function imageEngine(){return engine??=(await import(process.env.SHARP_MODULE||'sharp')).default;}
function source(value,dataDir){if(!value)return null;if(/^data:image\/(png|jpe?g|webp);base64,/.test(value))return Buffer.from(value.split(',')[1],'base64');if(/^\/media\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(value))return fs.readFileSync(path.join(dataDir,'media',path.basename(value)));if(/^\/[a-zA-Z0-9_.-]+\.(png|jpg|webp)$/.test(value))return fs.readFileSync(path.resolve('dist',value.slice(1)));throw Error('مصدر صورة البطاقة غير مدعوم.');}
export async function walletImages(card,member,dataDir){
 const sharp=await imageEngine(),overlays=[],w=690,h=1010;
 let base=sharp({create:{width:w,height:h,channels:4,background:card.color||'#204b3c'}});
 if(card.background)base=sharp(source(card.background,dataDir),{limitInputPixels:40000000}).resize(w,h,{fit:'cover'});
 const bg=await base.png().toBuffer();
 if(card.backgroundDim)overlays.push({input:Buffer.from('<svg width="690" height="1010"><rect width="100%" height="100%" fill="black" opacity="'+Math.min(.85,card.backgroundDim/100)+'"/></svg>'),left:0,top:0});
 const p=Loyalty.program(card),earned=p.type==='points'?Math.min(card.target,Math.floor((member.points||0)/p.pointsCost*card.target)):member.stamps||0,n=card.target||4;
 const stripLayers=[],positions=WalletLayout.positions(card);
 const progress=WalletLayout.progress(card,member);if(progress.mode==='image'&&card.stampImage&&card.stampEmptyImage){const empty=await sharp(source(card.stampEmptyImage,dataDir)).resize(566,170,{fit:'contain',background:'#00000000'}).png().toBuffer(),full=await sharp(source(card.stampImage,dataDir)).resize(566,170,{fit:'contain',background:'#00000000'}).png().toBuffer(),fillWidth=Math.round(566*progress.ratio),layers=[{input:empty,left:0,top:0}];if(fillWidth)layers.push({input:await sharp(full).extract({left:0,top:0,width:fillWidth,height:170}).png().toBuffer(),left:0,top:0});const fill=await sharp({create:{width:566,height:170,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();overlays.push({input:fill,left:62,top:255});stripLayers.push({input:await sharp(fill).resize(880,264).png().toBuffer(),left:100,top:48});}
 if(progress.mode!=='icons'&&progress.mode!=='none'&&progress.mode!=='image'){overlays.push({input:Buffer.from(WalletLayout.progressSVG(card,member)),left:0,top:0});stripLayers.push({input:await sharp(Buffer.from(WalletLayout.progressSVG(card,member))).extract({left:0,top:230,width:690,height:230}).resize(1080,360).png().toBuffer(),left:0,top:0});}
 for(let i=0;progress.mode==='icons'&&i<n;i++){
  const item=positions[i],size=Math.round(Math.min(300,Math.max(32,(item?.size||38)*2))),isEarned=i<earned,src=isEarned?card.stampImage:(card.stampEmptyImage||card.stampImage);
  let bytes;if(src)bytes=await sharp(source(src,dataDir),{limitInputPixels:40000000}).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  else bytes=Buffer.from(WalletLayout.art(card,isEarned,size));
  const x=item?.x??(15+i*70/Math.max(1,n-1)),y=item?.y??45,left=Math.max(0,Math.min(w-size,Math.round(w*x/100-size/2))),top=Math.max(0,Math.min(h-size,Math.round(h*y/100-size/2)));
  overlays.push({input:bytes,left,top});
  const stripSize=Math.min(160,Math.floor(940/n));stripLayers.push({input:await sharp(bytes).resize(stripSize,stripSize).png().toBuffer(),left:Math.round((i+.5)*1080/n-stripSize/2),top:Math.round((360-stripSize)/2)});
 }
 const poster=await sharp(bg).composite(overlays).png({palette:true,colours:128,effort:7}).toBuffer();
 const stripBG=await sharp(bg).resize(1080,360,{fit:'cover'}).modulate({brightness:.7}).png().toBuffer(),strip=await sharp(stripBG).composite(stripLayers).png({palette:true,colours:128,effort:7}).toBuffer();
 const result={backgroundURL:'data:image/png;base64,'+poster.toString('base64'),stripURL:'data:image/png;base64,'+strip.toString('base64')};
 if(card.logo)result.logoURL='data:image/png;base64,'+(await sharp(source(card.logo,dataDir),{limitInputPixels:40000000}).resize(320,160,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png({palette:true,colours:128}).toBuffer()).toString('base64');
 if(poster.length>1048576||strip.length>1048576||Buffer.byteLength(JSON.stringify(result))>1800000)throw Error('صور البطاقة تتجاوز حجم Wallet المدعوم. خفّض دقة الخلفية.');
 return result;
}
