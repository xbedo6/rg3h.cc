'use strict';
const beforePortraitHome=homeHTML;
homeHTML=function(){
 const box=document.createElement('div');box.innerHTML=beforePortraitHome();
 box.querySelectorAll('.gallery-heading,.gallery-hint').forEach(el=>el.remove());
 const stage=box.querySelector('.media-gallery');
 if(stage){stage.className='media-gallery portrait-gallery';stage.setAttribute('role','region');stage.setAttribute('aria-label','تصاميم صابونة ولاتيه وحلاق العنوان، حرّك الماوس أو اسحب أو استخدم الأسهم');stage.innerHTML='<div class="portrait-space" aria-hidden="true"></div><div class="portrait-deck">'+[['sabon','تصميم بطاقة صابونة'],['latte','تصميم بطاقة لاتيه كافي'],['address','تصميم بطاقة حلاق العنوان']].map(([id,label],i)=>`<figure class="portrait-card portrait-${id}" data-position="${i-1}"><div class="portrait-face"><img src="/hero-${id}-card.png" alt="${label}" width="226" height="402" decoding="async" draggable="false"></div></figure>`).join('')+'</div>';}
 return box.innerHTML;
};
const beforePortraitBind=bindGallery;
bindGallery=function(){
 const stage=document.querySelector('.portrait-gallery');if(!stage)return beforePortraitBind();
 const cards=[...stage.querySelectorAll('.portrait-card')],reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,drag=null,pan=0,targetPan=0,targetX=0,targetY=0,x=0,y=0,pop=0,targetPop=0,active=true;
 stage.tabIndex=0;
 function paint(){frame=0;const rect=stage.getBoundingClientRect(),w=stage.clientWidth,small=w<640,cardWidth=small?Math.min(170,w*.31):Math.min(278,w*.235),space=small?cardWidth*.9:cardWidth*1.18;
  const progress=Math.max(0,Math.min(1,(innerHeight-rect.top)/(innerHeight*.85)));targetPop=reduce.matches?0:progress;
  x+=(targetX-x)*.14;y+=(targetY-y)*.14;pop+=(targetPop-pop)*.12;pan+=(targetPan-pan)*.14;
  cards.forEach(card=>{const p=Number(card.dataset.position),z=reduce.matches?0:pop*(p===0?140:70),scale=reduce.matches?1:.88+pop*.13;
   card.style.width=cardWidth+'px';card.style.transform=`translate(-50%,-50%) translate3d(${p*space+x*(small?20:44)+pan}px,${p===0?-14:20}px,${z}px) rotateX(${reduce.matches?0:-y*9+4-pop*4}deg) rotateY(${reduce.matches?0:-p*16+x*16}deg) rotateZ(${reduce.matches?0:p*3-x*2}deg) scale(${scale})`;card.style.zIndex=String(p===0?3:2);
  });
  if(active&&!reduce.matches&&(Math.abs(targetX-x)+Math.abs(targetY-y)+Math.abs(targetPop-pop)+Math.abs(targetPan-pan)>.008))schedule();
 }
 function schedule(){if(!frame&&active)frame=requestAnimationFrame(paint);}
 function move(e){const r=stage.getBoundingClientRect();if(drag!==null){const limit=stage.clientWidth*(stage.clientWidth<640?.025:.07);targetPan=Math.max(-limit,Math.min(limit,e.clientX-drag));}targetX=reduce.matches?0:Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));targetY=reduce.matches?0:Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));schedule();}
 function down(e){if(!e.isPrimary)return;drag=e.clientX;stage.setPointerCapture(e.pointerId);stage.classList.add('is-dragging');}
 function release(){drag=null;targetPan=0;stage.classList.remove('is-dragging');targetX=0;targetY=0;schedule();}
 function leave(){if(drag!==null)return;targetX=targetY=0;schedule();}
 function key(e){if(!['ArrowLeft','ArrowRight','Home','Escape'].includes(e.key))return;e.preventDefault();targetX=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;targetY=0;schedule();}
 stage.addEventListener('pointermove',move);stage.addEventListener('pointerdown',down);stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('pointerleave',leave);stage.addEventListener('keydown',key);
 window.addEventListener('scroll',schedule,{passive:true});const observer=new ResizeObserver(schedule);observer.observe(stage);reduce.addEventListener('change',schedule);
 stage._cleanup=()=>{active=false;if(frame)cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule);reduce.removeEventListener('change',schedule);};schedule();
};
render();
