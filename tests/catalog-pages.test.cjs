const test=require('node:test');
const assert=require('node:assert/strict');
const c=require('../netlify/lib/public-catalog');
const {handler}=require('../netlify/functions/catalog-page');
const row={id:'public-id',sku:'NEW-POLLO',slug:'pollo-al-romero-and-limon-copy-121110',name_es:'Pollo Mechado Criollo',collection:'Cocina',category:'Proteínas',price:16,status:'active',stock:4,unit_label:'Lbs',units_per_pack:1,net_weight_label:'454 g (1 lb)',image_url:'https://example.com/pollo.webp',gallery_images:[{url:'https://example.com/pack.webp',alt:'Empaque real'}],digital_file_path:'PRIVATE_DO_NOT_RENDER',description_es:'Producto <script>alert(1)</script>'};
function mock(rows=[row],balances=[]){global.fetch=async url=>({ok:true,status:200,json:async()=>url.includes('inventory_balances')?balances:rows});}
test('New product works without a static HTML file; SEO and gallery use current data',async()=>{
  mock();const result=await handler({queryStringParameters:{kind:'products',slug:row.slug}});
  assert.equal(result.statusCode,200);assert.match(result.body,/Pollo Mechado Criollo/);assert.match(result.body,/Lbs · 454 g \(1 lb\)/);assert.match(result.body,/data-gallery-src/);assert.match(result.body,/og:image.*example.com\/pollo.webp/);assert.ok(!result.body.includes('PRIVATE_DO_NOT_RENDER'));assert.ok(!result.body.includes('<script>alert(1)</script>'));
});
test('Hidden or nonexistent products produce real 404, not an old static page',async()=>{
  mock([]);const r=await handler({queryStringParameters:{kind:'products',slug:'hidden'}});assert.equal(r.statusCode,404);assert.match(r.body,/noindex/);
});
test('Public data failure produces 503 instead of stale price and stock',async()=>{
  global.fetch=async()=>({ok:false,status:500});assert.equal((await handler({queryStringParameters:{kind:'products',slug:row.slug}})).statusCode,503);
});
test('Collection reflects current price, availability and members',()=>{
  const body=c.renderCollection([{...row,price:17,status:'sold_out'}],'cocina');assert.match(body,/\$17.00/);assert.match(body,/Agotado temporalmente/);assert.match(body,new RegExp(row.slug));
});
test('Reserved stock produces OutOfStock metadata',async()=>{
  mock([row],[{product_id:row.id,quantity:4,reserved_quantity:4}]);const r=await handler({queryStringParameters:{kind:'products',slug:row.slug}});assert.match(r.body,/schema.org\/OutOfStock/);
});
test('Group URL resolves primary and lists only published members',()=>{
  const members=[{...row,slug:'small',web_group_key:'group',web_group_slug:'new-group',web_group_primary:true},{...row,id:'two',slug:'large',web_group_key:'group',web_group_slug:'new-group'}];const r=c.findProduct(members,'new-group');assert.equal(r._members.length,2);assert.equal(c.groups(members).length,1);assert.match(c.renderProduct(r,'new-group'),/large/);
});
test('Invalid slug and collection are rejected before data request',async()=>{
  assert.equal((await handler({queryStringParameters:{kind:'products',slug:'../bad'}})).statusCode,404);assert.equal((await handler({queryStringParameters:{kind:'collections',slug:'unknown'}})).statusCode,404);
});
test('Dangerous image URLs and JSON closing tags cannot inject executable markup',()=>{
  const body=c.renderProduct({...row,image_url:'javascript:alert(1)',name_es:'</script><script>alert(1)</script>'},row.slug);assert.ok(!body.includes('src="javascript:'));assert.ok(!body.includes('</script><script>alert(1)</script>'));
});
