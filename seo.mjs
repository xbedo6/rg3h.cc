export function seoHeaders(url,res){
 const privatePage=/^\/(admin|login)\/?$/.test(url.pathname)||/\/(demo|invoice|support|marketing)\.html$/.test(url.pathname)||['join','member','card','branch','switch'].some(k=>url.searchParams.has(k));
 if(privatePage)res.setHeader('X-Robots-Tag','noindex, nofollow');
}
