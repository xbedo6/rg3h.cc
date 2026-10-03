
'use strict';
const supportBaseRender=render;
render=function(){supportBaseRender();if(publicPage)return;const nav=document.querySelector('.side-nav');if(nav&&!nav.querySelector('[data-support-link]'))nav.insertAdjacentHTML('beforeend',`<a class="support-dashboard-link" data-support-link href="/support.html">${icon('help')}${role==='admin'?'الدعم والتذاكر':'الدعم والمساعدة'}</a>`);if(role==='client')document.querySelector('.workspace')?.insertAdjacentHTML('beforeend','<div class="support-customer-link"><a href="/support.html">الدعم والمساعدة</a></div>');};
render();
