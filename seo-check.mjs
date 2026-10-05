import assert from 'node:assert/strict';
import fs from 'node:fs';
import {seoHeaders} from './seo.mjs';
const xml=fs.readFileSync('dist/sitemap.xml','utf8'),locations=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.equal(locations.length,12);assert.equal(new Set(locations).size,12);
for(const url of locations){const p=new URL(url).pathname,file=p==='/'?'dist/index.html':'dist'+p,html=fs.readFileSync(file,'utf8');assert.equal([...html.matchAll(/rel="canonical"/g)].length,1);assert.ok(html.includes('href="'+url+'"'));assert.ok(/<h1[ >]/.test(html));assert.ok(html.includes('name="description"'));for(const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(m[1]);}
for(const pathname of ['/admin','/login','/?join=test','/invoice.html','/marketing.html','/support.html','/demo.html']){const headers={};seoHeaders(new URL('https://rg3h.cc'+pathname),{setHeader:(k,v)=>headers[k]=v});assert.equal(headers['X-Robots-Tag'],'noindex, nofollow');}
for(const pathname of ['/','/loyalty-cards.html','/coffee-loyalty.html']){let set=false;seoHeaders(new URL('https://rg3h.cc'+pathname),{setHeader:()=>set=true});assert.equal(set,false);}
console.log('SEO checks passed: 12 canonical public URLs, visible H1/descriptions, valid structured data and private routes excluded.');
