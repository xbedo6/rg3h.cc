'use strict';
function resetWorkspaceFilters(){analyticsScope='current';branchFilter='all';operationCard='all';operationKind='all';operationEmployee='all';operationSearch='';}
let recoveryScreen=new URLSearchParams(location.search).has('recover'),recoveryToken=recoveryScreen?location.hash.slice(1):'',recoveryError='',recoveryBusy=false;
if(recoveryScreen)history.replaceState(null,'',location.pathname+'?recover=1');
function recoveryHTML(){return `<main class="auth-layout"><section><h1>استعادة بطاقة الولاء</h1><p>يصدر هذا الرابط من فريق النشاط بعد التحقق من ملكيتك للبطاقة. يعيد رصيدك الحالي كما هو.</p></section><section class="panel auth-panel"><h2>افتح بطاقتك على هذا الجهاز</h2><p class="sub">الرابط صالح لعشر دقائق ولمرة واحدة. عند المتابعة تُلغى جلسات هذه البطاقة السابقة. لا تشارك الرابط مع غيرك.</p>${principal?'<p class="notice">سيتم استبدال جلسة الحساب المفتوح هنا بجلسة بطاقة العميل.</p>':''}<p class="error" role="alert">${esc(recoveryError||(!recoveryToken?'الرابط غير مكتمل. اطلب رابطًا جديدًا من فريق النشاط.':''))}</p><button class="btn primary full" data-action="consume-recovery" ${!recoveryToken||recoveryBusy?'disabled':''}>${recoveryBusy?'جارٍ استعادة البطاقة…':'استعادة بطاقتي'}</button><a class="btn secondary full mt" href="/">العودة إلى الموقع</a></section></main>`;}
function recoveryForm(){return `<form id="customer-recovery-form"><label class="field"><span>البطاقة</span><select name="shop">${db.shops.filter(s=>!s.archivedAt).map(s=>`<option value="${esc(s.id)}" ${s.id===db.shop?'selected':''}>${esc(s.card.title||s.name)}</option>`).join('')}</select></label><label class="field"><span>رقم جوال العميل</span><input class="input" name="phone" type="tel" dir="ltr" autocomplete="off" required placeholder="05xxxxxxxx"></label><p class="notice">تحقق من هوية العميل وملكية رقم الجوال مباشرة، وفق إجراءات نشاطك. معرفة الرقم وحدها لا تكفي. لا ترسل الرابط لشخص آخر ولا تنشره.</p><label class="terms"><input type="checkbox" name="confirmed" required>تحققت من هوية العميل وملكية رقم الجوال</label><p class="error" role="alert"></p><button class="btn primary full" type="submit">إصدار رابط استعادة آمن</button></form>`;}
mutationActions.add('issue-recovery');mutationActions.add('consume-recovery');
const safetyRender=render;
render=function(){
 if(recoveryScreen){document.querySelector('#app').innerHTML=recoveryHTML();document.documentElement.classList.add('ready');return;}
 safetyRender();
 const s=shop();
 if(s&&role!=='admin'){
  const employee=s.employees.find(e=>e.id===staffEmployee),branches=s.branches||[];
  const label=role==='staff'?(branches.find(b=>b.id===employee?.branchId)?.name||'بدون فرع'):(s.card.branchIds?.length?s.card.branchIds.map(id=>branches.find(b=>b.id===id)?.name).filter(Boolean).join('، '):branches.length?'جميع الفروع':'بدون فروع');
  const footer=document.querySelector('.sidebar-foot .shop-chip small');if(footer)footer.textContent=label;
 }
 if(serverMode&&db.scopedBusiness&&role==='owner'){
  const label=document.querySelector('.demo-label');if(label)label.textContent='معاينة إدارة · '+(shopAccount()?.name||s?.name||'');
 }
 if((window.RIJAA_DEMO||serverMode&&['owner','employee'].includes(principal?.kind))&&((role==='staff'&&view==='scan')||(role==='owner'&&view==='customers'))){
  document.querySelector('.main')?.insertAdjacentHTML('beforeend','<section class="panel mt"><h2>استرجاع بطاقة العميل</h2><p class="sub">لعميل فقد رابط بطاقته أو غيّر جهازه. إصدار رابط مؤقت بعد التحقق من الملكية، دون تغيير الرصيد.</p><button class="btn secondary mt" data-action="issue-recovery">استرجاع بطاقة عميل</button></section>');
 }
 if(serverMode&&role==='client'){
  document.querySelectorAll('.steps .step-number').forEach((el,i)=>el.textContent=fmt(i+1));
  if(clientStage==='phone')document.querySelector('.phone-bottom')?.insertAdjacentHTML('beforeend','<button type="button" class="btn quiet full mt" data-action="recovery-help">كيف أسترجع بطاقتي؟</button>');
  document.querySelectorAll('.phone-bottom').forEach(el=>{if(el.textContent.includes('معاينة تجريبية'))el.textContent='اعرض رمز البطاقة للموظف. إضافة البطاقة إلى محافظ الجوال متاحة من زر إضافة البطاقة.';});
 }
};
window.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b||!['issue-recovery','consume-recovery','copy-recovery','recovery-help'].includes(b.dataset.action))return;
 e.preventDefault();e.stopImmediatePropagation();if(window.RIJAA_DEMO)return;
 if(b.dataset.action==='recovery-help'){modal('استرجاع بطاقتك','<p>راجع الموظف أو صاحب النشاط واطلب استرجاع البطاقة. بعد التحقق من هويتك وملكية رقم الجوال، يعطيك رابطًا مؤقتًا أو رمز QR. افتحه على جهازك واضغط «استعادة بطاقتي». يحتفظ برصيدك ويُلغي جلسات البطاقة السابقة.</p><p>الرابط صالح لعشر دقائق ولمرة واحدة. لا تشاركه مع أي شخص.</p><a href="/privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a>');return;}
 if(b.dataset.action==='issue-recovery'){if(!canOperate())return toast('يلزم تفعيل الاشتراك.');modal('استرجاع بطاقة العميل',recoveryForm());return;}
 if(b.dataset.action==='copy-recovery'){try{await navigator.clipboard.writeText(document.querySelector('#recovery-link').value);toast('تم نسخ الرابط. سلّمه للعميل الذي تحققت من هويته فقط.');}catch{toast('انسخ الرابط من الحقل الظاهر.');}return;}
 if(recoveryBusy||!recoveryToken)return;recoveryBusy=true;recoveryError='';render();
 try{const j=await api('/api/customer/recovery/consume',{token:recoveryToken});recoveryToken='';recoveryScreen=false;history.replaceState(null,'',location.pathname);emailAccept(j);}catch(err){recoveryError=err.message;}finally{recoveryBusy=false;render();}
},true);
window.addEventListener('submit',async e=>{
 const f=e.target;if(f.getAttribute('id')!=='customer-recovery-form')return;e.preventDefault();e.stopImmediatePropagation();if(window.RIJAA_DEMO)return;
 const d=new FormData(f),button=f.querySelector('button');if(button.disabled)return;button.disabled=true;
 try{const j=await api('/api/customer/recovery/issue',{shop:d.get('shop'),phone:d.get('phone'),ownershipConfirmed:d.get('confirmed')==='on'});modal('رابط استعادة '+j.name,`<p>سلّم الرابط للعميل الذي تحققت من هويته فقط. ينتهي ${esc(new Date(j.expires).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}))}، ويُستخدم مرة واحدة. إصدار رابط جديد يُلغي الرابط السابق.</p><div class="registration-code">${qr(j.url)}</div><input id="recovery-link" class="input" dir="ltr" readonly aria-label="رابط استعادة البطاقة" value="${esc(j.url)}">`,'<button class="btn primary" data-action="copy-recovery">نسخ رابط الاستعادة</button>');}catch(err){f.querySelector('.error').textContent=err.message;}finally{button.disabled=false;}
},true);
render();
