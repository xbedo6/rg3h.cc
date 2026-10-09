(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Engagement=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DAY=86400000;
 function defaults(){return {levels:{enabled:false,metric:'visits',window:0,tiers:[{id:'silver',name:'فضي',threshold:5,multiplier:1,benefit:''},{id:'gold',name:'ذهبي',threshold:15,multiplier:1,benefit:''}]},offers:[],reminders:[{id:'inactive',enabled:false,days:30,cooldown:30,template:'',language:'ar'},{id:'near',enabled:false,days:30,cooldown:7,template:'',language:'ar'},{id:'ready',enabled:false,days:30,cooldown:7,template:'',language:'ar'}]};}
 function settings(sh){const d=defaults(),c=sh.engagement||{};return {...d,...c,levels:{...d.levels,...c.levels}};}
 function history(sh,m,time){return (sh.logs||[]).filter(l=>l.member===m.id&&l.type==='stamp'&&!l.undone&&l.time<=time);}
 function level(sh,m,time=Date.now(),memberHistory){
  const c=settings(sh).levels;if(!c.enabled)return null;
  const logs=(memberHistory||history(sh,m,time)).filter(l=>!c.window||l.time>=time-c.window*DAY);
  const value=c.metric==='spend'?Math.round(logs.reduce((n,l)=>n+(Number.isFinite(l.saleAmount)&&l.saleAmount>=0?l.saleAmount:0),0)*100)/100:c.window?logs.length:(m.visits||0);
  const achieved=c.tiers.filter(t=>t.threshold<=value),current=achieved.at(-1),next=c.tiers.find(t=>t.threshold>value),start=current?.threshold||0;
  return {id:current?.id||'base',name:current?.name||'عضو',benefit:current?.benefit||'',multiplier:current?.multiplier||1,value,metric:c.metric,window:c.window,next:next?{name:next.name,remaining:Math.max(0,Math.round((next.threshold-value)*100)/100),threshold:next.threshold}:null,percent:next?Math.max(0,Math.min(100,Math.floor((value-start)/(next.threshold-start)*100))):100};
 }
 // Riyadh has a fixed UTC+3 offset. Anchor overnight offers to their start day.
 function clock(time){const d=new Date(time+3*3600000);return {day:d.getUTCDay(),date:d.toISOString().slice(0,10),minute:d.getUTCHours()*60+d.getUTCMinutes()};}
 function minutes(value){const [h,m]=value.split(':').map(Number);return h*60+m;}
 function offerActive(o,branchId,time){
  if(!o.enabled||(o.branchIds.length&&!o.branchIds.includes(branchId)))return false;
  let c=clock(time);const a=minutes(o.start),b=minutes(o.end);
  if(a<b){if(c.minute<a||c.minute>=b)return false;}
  else{if(c.minute>=b&&c.minute<a)return false;if(c.minute<b)c=clock(time-DAY);}
  return o.days.includes(c.day)&&(!o.from||c.date>=o.from)&&(!o.until||c.date<=o.until);
 }
 function award(sh,m,branchId,time=Date.now()){
  const p=sh.card.program||{};if(p.type!=='points')return {points:0,multiplier:1,offer:null,level:level(sh,m,time)};
  const membership=level(sh,m,time),eligible=settings(sh).offers.filter(o=>offerActive(o,branchId,time)).sort((a,b)=>b.multiplier-a.multiplier||a.id.localeCompare(b.id)),best=eligible[0];
  const multiplier=Math.max(membership?.multiplier||1,best?.multiplier||1);
  return {points:Math.floor((p.pointsPerVisit||10)*multiplier),multiplier,offer:best&&best.multiplier>= (membership?.multiplier||1)?{id:best.id,name:best.name}:null,level:membership};
 }
 function candidate(sh,m,r,time=Date.now(),memberHistory){
  const logs=memberHistory||history(sh,m,time),last=logs.reduce((n,l)=>Math.max(n,l.time),0),p=sh.card.program||{},available=(m.rewardItems?.length??m.rewards??0)+(p.type==='points'?Math.floor((m.points||0)/(p.pointsCost||100)):0);
  if(r.id==='inactive')return !!last&&time-last>=r.days*DAY;
  if(r.id==='ready')return available>0;
  return available===0&&(p.type==='points'?(m.points||0)>0&&(p.pointsCost||100)-(m.points||0)<=(p.pointsPerVisit||10)*(level(sh,m,time,logs)?.multiplier||1):(m.stamps||0)===sh.card.target-1);
 }
 return {DAY,defaults,settings,history,level,clock,offerActive,award,candidate};
});
