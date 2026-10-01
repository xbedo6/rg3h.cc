'use strict';
const beforeBrandRender=render;
render=function(){beforeBrandRender();document.querySelectorAll('.brand').forEach(el=>{el.innerHTML='<img class="rijaa-brand-logo" src="/brand-logo.png" alt="رجعة — نظام الولاء" width="240" height="96">';});};
render();
