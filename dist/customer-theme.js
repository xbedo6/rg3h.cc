'use strict';
function registrationTheme(s){
 const c=s.card||{},identity=[c.name,c.title,s.name,c.logo].join(' ').toLowerCase();
 if(/latte|لاتيه|لاتية|لاتي|لا كافي/.test(identity))return {id:'latte',logo:'/latte-logo.jpg',name:'لاتيه كافي',tag:'SPECIALTY COFFEE',headline:'قهوتك المفضلة.\nومكافأة تستاهلها.',intro:'كل زيارة لها طعم أجمل. انضم لبرنامج الولاء وخلي قهوتك القادمة أقرب.',accent:'#6b4631'};
 if(/sabon|صابونة|صابونه|صابون/.test(identity))return {id:'sabon',logo:'/sabonh-logo.png',name:'صابونة',tag:'A FRESH START, EVERY VISIT',headline:'لمعة جديدة.\nومزايا تزيد.',intro:'سيارتك تستاهل العناية، وأنت تستاهل المكافأة. سجّل بطاقتك وابدأ رحلتك معنا.',accent:'#096078'};
 if(/address|العنوان/.test(identity))return {id:'address',logo:'/address-logo.webp',name:'حلاق العنوان',tag:'THE ADDRESS · YOUR SIGNATURE',headline:'إطلالة لها عنوان.\nوولاء له تقدير.',intro:'عناية بالتفاصيل، في كل زيارة. انضم لبرنامج الولاء واستمتع بمزايا مصممة لك.',accent:'#e4c583'};
 return {id:'custom',logo:'',name:c.name||s.name||c.title||'بطاقة الولاء',tag:'LOYALTY · MADE FOR YOU',headline:'كل زيارة تقرّبك\nمن مكافأتك.',intro:'بطاقتك، مزاياك، ورصيدك في مكان واحد. انضم إلى برنامج الولاء الخاص بنشاطك.',accent:/^#[\da-f]{6}$/i.test(c.accent||'')?c.accent:'#c6e5b0'};
}
function customerBrand(s,t){const logo=s.card.logo||t.logo;return `<div class="enroll-brand">${logo?`<img src="${esc(logo)}" alt="${esc(s.card.name||t.name)}" width="160" height="64">`:`<span class="enroll-monogram">${icon(s.card.icon||'star')}</span>`}<span>${esc(s.card.name||t.name)}</span></div>`;}
const unthemedClientHTML=clientHTML;
clientHTML=function(){
 const s=shop();if(!s)return unthemedClientHTML();const t=registrationTheme(s),c=s.card,m=currentMember(),issued=clientStage==='card'&&m;
 if(clientStage==='otp')return unthemedClientHTML();
 return `<main class="customer-enrollment theme-${t.id}" style="--enroll-accent:${t.accent}"><header class="enroll-header">${customerBrand(s,t)}<span class="enroll-header-note">برنامج الولاء</span></header><div class="enroll-layout"><section class="enroll-story"><span class="enroll-kicker">${t.tag}</span><h1>${issued?'بطاقتك جاهزة.\nوالحلو لسه جاي.':t.headline}</h1><p class="enroll-intro">${issued?'اعرض رمز بطاقتك للموظف في كل زيارة. رصيدك ومكافآتك محفوظة في هذه البطاقة.':t.intro}</p><div class="enroll-benefit"><span>${icon('gift')}</span><div><small>مكافأتك القادمة</small><strong>${esc(Loyalty.label(c))}</strong><p>${esc(programSummary(c))}</p></div></div><div class="enroll-art ${issued?'is-issued':''}"><div class="enroll-art-ring" aria-hidden="true"></div><div class="enroll-card-preview">${cardHTML(c,issued?m:null,Boolean(issued))}</div>${!issued?'<span class="enroll-preview-label">معاينة بطاقتك · يبدأ رصيدك من الصفر عند التسجيل</span>':''}</div></section><section class="enroll-panel ${issued?'enroll-issued-panel':''}">${issued?`<span class="enroll-panel-kicker">أهلًا ${esc(m.name||'بك')}</span><h2>هذه بطاقتك الشخصية</h2><p class="enroll-form-intro">احتفظ برابط هذه الصفحة على جهازك لتصل لبطاقتك بسهولة.</p><div class="enroll-live-card">${cardHTML(c,m,true)}</div><p class="enroll-private-note">رمز البطاقة خاص بك. اعرضه للموظف عند تسجيل الزيارة أو استخدام المكافأة.</p>`:`<span class="enroll-panel-kicker">خطوة بسيطة، ومزايا أكثر</span><h2>خلّ بطاقتك معك</h2><p class="enroll-form-intro">الاسم والجوال فقط. بطاقتك جاهزة مباشرة بعد التسجيل.</p><form id="join-form"><label class="field"><span>اسمك</span><input class="input" name="name" autocomplete="given-name" maxlength="35" required placeholder="كيف نناديك؟" value="${esc(clientName)}"></label><label class="field"><span>رقم الجوال</span><input class="input" name="phone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" required placeholder="05xxxxxxxx" value="${esc(clientPhone)}"></label><label class="terms"><input type="checkbox" name="terms" required><span>أوافق على <button type="button" data-action="terms">شروط برنامج الولاء</button> واستخدام بياناتي لإدارة بطاقتي.</span></label><button class="btn primary full enroll-submit" type="submit"><span>إصدار بطاقتي</span>${icon('logout')}</button><p class="error" id="join-error" role="alert" aria-live="polite"></p></form><div class="enroll-trust">${icon('shield')} بياناتك لإدارة عضويتك ورصيدك.</div><div class="enroll-recovery"><span>عندك بطاقة وفقدت رابطها؟</span><button class="btn quiet" type="button" data-action="recovery-help">طريقة استرجاع بطاقتي</button></div>`}<footer class="enroll-legal"><button type="button" data-action="terms">شروط الولاء</button><span>·</span><a href="/privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a></footer></section></div><footer class="enroll-footer">${esc(s.card.name||t.name)} · ${esc(c.title||'برنامج الولاء')}</footer></main>`;
};
const themedCustomerRender=render;
render=function(){
 themedCustomerRender();const enrollment=document.querySelector('.customer-enrollment');document.body.classList.toggle('customer-themed',Boolean(enrollment));
 if(enrollment){
  document.querySelectorAll('.topbar,.public-nav').forEach(el=>el.remove());
  document.title=(shop().card.name||registrationTheme(shop()).name)+' · '+(clientStage==='card'?'بطاقتي':'تسجيل بطاقة الولاء');
  const logo=shop().card.logo||registrationTheme(shop()).logo,favicon=document.querySelector('link[rel=icon]');
  if(favicon){if(logo)favicon.href=logo;else favicon.removeAttribute('href');}
  document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);
  document.querySelector('meta[name="description"]')?.setAttribute('content','سجل بطاقة الولاء الخاصة بنشاطك بالاسم ورقم الجوال.');
  document.querySelector('meta[property="og:description"]')?.setAttribute('content','سجل بطاقة الولاء الخاصة بنشاطك بالاسم ورقم الجوال.');
  document.querySelector('meta[property="og:image"]')?.remove();
  if(enrollment.classList.contains('theme-custom')&&/^#[\da-f]{6}$/i.test(shop().card.color||'')){
   const color=shop().card.color,channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255),light=channels.reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)>.6;
   enrollment.style.setProperty('--enroll-paper',color);enrollment.style.setProperty('--enroll-ink',light?'#172d28':'#f2f8ee');enrollment.style.setProperty('--enroll-muted',light?'#344b44':'#d0ddd7');
  }
 }
 if(role==='owner'&&!publicPage&&view==='join')document.querySelector('.main .page-head')?.insertAdjacentHTML('afterend','<section class="registration-theme-note" role="note"><span>'+icon('star')+'</span><div><strong>رابط التسجيل بهوية بطاقتك</strong><p>الثيم الأساسي يأخذ شعار البطاقة وتصميمها تلقائيًا. يتم تجهيز ثيم مخصص لرابط تسجيل عملائك بمساعدة الذكاء الاصطناعي خلال ساعتين إلى 24 ساعة من طلب التخصيص، بما يناسب هوية نشاطك.</p></div></section>');
};
render();

