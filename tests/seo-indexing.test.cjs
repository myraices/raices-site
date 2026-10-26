const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const {handler}=require('../netlify/functions/sitemap-articles');
test('blog sitemap works with the current public schema without updated_at',async()=>{
 let request='';const prior=global.fetch;global.fetch=async url=>{request=String(url);assert(!request.includes('updated_at'));return {ok:true,json:async()=>[{slug:'bienestar-y-raices',published_at:'2026-07-26T12:00:00Z'}]};};
 try{const r=await handler();assert.equal(r.statusCode,200);assert.match(r.body,/<loc>https:\/\/myraices.com\/blog\/bienestar-y-raices<\/loc>/);assert(!r.body.includes('lastmod'));}finally{global.fetch=prior;}
});
test('unavailable blog data is a retryable error, never a fabricated successful empty sitemap',async()=>{
 const prior=global.fetch;global.fetch=async()=>({ok:false,status:503,text:async()=>''});try{assert.equal((await handler()).statusCode,503);}finally{global.fetch=prior;}
});
test('sitemaps cover both collection languages and omit private pages and guessed modification dates',()=>{
 const collections=fs.readFileSync(path.join(root,'sitemaps/collections.xml'),'utf8');
 for(const slug of ['cocina','herbal','dulces','home','wellness'])for(const lang of ['','?lang=en'])assert(collections.includes(`/collections/${slug}/${lang}</loc>`));
 for(const file of ['sitemap.xml','sitemaps/collections.xml','sitemaps/pages.xml']){
  const xml=fs.readFileSync(path.join(root,file),'utf8');assert(!xml.includes('<lastmod>'));assert(!xml.includes('/account'));assert(!xml.includes('/checkout-preview'));assert(!xml.includes('/order-confirmation'));
 }
});
test('public category links exist in initial HTML and utility routes retain noindex',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const slug of ['cocina','herbal','dulces','home','wellness'])assert(html.includes(`href="/collections/${slug}/" data-category-nav=`));
 const headers=fs.readFileSync(path.join(root,'_headers'),'utf8');for(const name of ['account','checkout-preview','order-confirmation','manage-order'])for(const ext of ['','.html'])assert(headers.includes('/'+name+ext+'\n  X-Robots-Tag: noindex, nofollow'));
});
test('robots makes transformed images crawlable, keeps functions blocked, and allows noindex to be read',()=>{
 const rules=fs.readFileSync(path.join(root,'robots.txt'),'utf8').split('\n').map(x=>x.match(/^(Allow|Disallow): (.+)$/)).filter(Boolean).map(m=>({allow:m[1]==='Allow',path:m[2]}));
 const allowed=url=>rules.filter(r=>url.startsWith(r.path)).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow))[0]?.allow??true;
 assert(allowed('/.netlify/images?url=/assets/a.webp'));assert(!allowed('/.netlify/functions/create-square-checkout'));assert(allowed('/account'));assert(allowed('/account.html'));
});
test('collection discovery follows published catalog and empty collections remain usable without indexation',async()=>{
 const prior=global.fetch;
 global.fetch=async url=>({ok:true,json:async()=>String(url).includes('inventory_balances')?[]:[{id:'one',slug:'arepa',name_es:'Arepa',display_category:'Kitchen',status:'active',price:17,stock:2}]});
 try{
  const result=await require('../netlify/functions/sitemap-collections').handler();assert.equal(result.statusCode,200);assert.match(result.body,/collections\/cocina\//);assert.match(result.body,/lang=en/);assert(!result.body.includes('/wellness/'));
  const c=require('../netlify/lib/public-catalog');assert.match(c.renderCollection([],'wellness'),/content="noindex, follow"/);
 }finally{global.fetch=prior;}
});
