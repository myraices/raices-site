const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const c=require('../netlify/lib/public-catalog'),{handler}=require('../netlify/functions/catalog-page');
const row={id:'new-id',sku:'NEW',slug:'new-product',status:'active',stock:3,collection:'Cocina',category:'Proteínas',price:16,name_es:'Pollo Mechado Criollo',name_en:'Creole Shredded Chicken',description_es:'Descripción española',description_en:'English product description',long_description_es:'Preparado en español',long_description_en:'Prepared product in English',benefits_es:['Característica española'],benefits_en:['English feature'],ingredients_text_es:'Pollo',ingredients_text_en:'Chicken',conservation_text_es:'Mantener congelado',conservation_text_en:'Keep frozen',preparation_text_es:'Calentar',preparation_text_en:'Heat before serving',unit_label:'Paquete',units_per_pack:6};
test('English product uses translated content, actions, header/footer, metadata and language links',()=>{
 const h=c.renderProduct(row,row.slug,'en');
 for(const text of ['<html lang="en">','Creole Shredded Chicken','Prepared product in English','English feature','Chicken','Keep frozen','Heat before serving','Buy in the shop','Returns and refunds','Pack · 6 units','id="catalogLanguageToggle"','?lang=en','hreflang="en"'])assert.ok(h.includes(text),text);
 assert.ok(!h.includes('Preparado en español'));assert.ok(!h.includes('>Comprar en la tienda<'));assert.ok(h.includes('product=new-product&amp;lang=en#shop'));
 const schema=JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(schema.name,row.name_en);assert.equal(schema.description,row.long_description_en);
});
test('English collections retain language on product links and translate collection labels',()=>{
 const h=c.renderCollection([row],'cocina','en');assert.match(h,/<h1>Kitchen<\/h1>/);assert.match(h,/Creole Shredded Chicken/);assert.match(h,/View product/);assert.match(h,/products\/new-product\/\?lang=en/);
});
test('Spanish and missing-translation fallback remain usable',()=>{
 assert.match(c.renderProduct(row,row.slug,'es'),/<h1>Pollo Mechado Criollo<\/h1>/);
 assert.match(c.renderProduct({...row,name_en:'',long_description_en:'',description_en:''},row.slug,'en'),/<h1>Pollo Mechado Criollo<\/h1>/);
});
test('Function serves English HTML before client JavaScript executes',async()=>{
 global.fetch=async url=>({ok:true,json:async()=>url.includes('inventory_balances')?[]:[row]});
 const response=await handler({queryStringParameters:{kind:'products',slug:row.slug,lang:'en'}});assert.equal(response.statusCode,200);assert.match(response.body,/<html lang="en">/);assert.match(response.body,/Creole Shredded Chicken/);
});
function client(saved,href,rendered='es',blocked=false){
 const script=fs.readFileSync(require.resolve('../js/catalog-language.js'),'utf8'),events={},clicks={};let redirected=null;
 const storage=new Map([['raices_lang',saved]]);
 const context={URL,location:{href,replace:u=>redirected=u,assign:u=>redirected=u},localStorage:{getItem:k=>{if(blocked)throw Error('Blocked');return storage.get(k)},setItem:(k,v)=>{if(blocked)throw Error('Blocked');storage.set(k,v)}},document:{documentElement:{lang:rendered},addEventListener:(name,fn)=>events[name]=fn,getElementById:()=>({addEventListener:(name,fn)=>clicks[name]=fn})}};
 vm.runInNewContext(script,context);return {get redirected(){return redirected},storage,events,clicks};
}
test('Saved English preference redirects legacy links to English once',()=>{
 const r=client('en','https://myraices.com/products/new-product/');assert.equal(r.redirected,'https://myraices.com/products/new-product/?lang=en');
 const next=client('en',r.redirected,'en');assert.equal(next.redirected,null);
});
test('Explicit Spanish overrides saved English and selector returns to English',()=>{
 const r=client('en','https://myraices.com/products/new-product/?lang=es');assert.equal(r.redirected,null);assert.equal(r.storage.get('raices_lang'),'es');r.events.DOMContentLoaded();r.clicks.click();assert.equal(r.redirected,'https://myraices.com/products/new-product/?lang=en');
});
test('Language URL retains product query and shop hash; storage restrictions are tolerated',()=>{
 assert.equal(c.languageUrl('/?product=new#shop','en'),'/?product=new&lang=en#shop');
 assert.equal(client('en','https://myraices.com/products/new-product/?lang=en','en',true).redirected,null);
});
