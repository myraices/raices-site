const test=require('node:test'),assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/create-square-checkout');
const {handler:validate}=require('../netlify/functions/validate-promotion');
const originalFetch=global.fetch;
const userId='10000000-0000-4000-8000-000000000001';
const promotion={id:'20000000-0000-4000-8000-000000000001',code:'BIENVENIDO10',active:true,first_purchase_only:true,discount_type:'percentage',value:10,minimum_cents:0,updated_at:'2026-10-23T00:00:00Z'};
const customer={name:'Test User',email:'buyer@example.com',phone:'1234567890',address:'123 Test St',city:'Katy',state:'TX',zip:'77493',addressVerified:true,placeId:'verified-place'};
const products=[{id:'a',sku:'FOOD',price:30,name_es:'Arepas',status:'active',stock:20,tax_status:'food_exempt'},{id:'b',sku:'HOME',price:20,name_es:'Hogar',status:'active',stock:20,tax_status:'physical_taxable'}];
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}
async function run(options={}){
 const calls=[],events=[];
 process.env.SUPABASE_URL='https://database.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';process.env.SQUARE_ACCESS_TOKEN='test-token';process.env.SQUARE_LOCATION_ID='test-location';process.env.SQUARE_ENVIRONMENT='sandbox';
 global.fetch=async(url,init={})=>{
  const method=init.method||'GET',body=init.body?JSON.parse(init.body):null;calls.push({url,method,body});
  if(url.endsWith('/auth/v1/user'))return reply({id:userId,email:'buyer@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'});
  if(url.includes('/products?'))return reply(products);
  if(url.includes('/promotion_codes?'))return reply([{...promotion,...options.promotion}]);
  if(url.includes('/rpc/promotion_customer_state'))return reply(options.state||{eligible:true,pending:false});
  if(url.includes('/rpc/promotion_usage_count'))return reply(options.used||0);
  if(url.includes('/nurai_settings?section=eq.operation'))return reply([{settings:{delivery_zones:[{name:'Katy',zips:['77493'],fee:5}],free_delivery_enabled:false}}]);
  if(url.includes('/nurai_settings?section=eq.logistics'))return reply([{settings:{}}]);
  if(url.includes('/nurai_settings?section=eq.payments'))return reply([{settings:{sales_tax:{states:[{state:'TX',rate:8.25}]}}}]);
  if(url.includes('/rpc/reserve_promotion')){events.push('reserve');return options.reserveError?reply({message:options.reserveError},400):reply({session_id:body.p_session_id});}
  if(url.includes('/checkout_sessions')){events.push('session');return reply([{id:body?.id}]);}
  function amounts(order){
   const discounts=new Map((order.discounts||[]).map(d=>[d.uid,d.amount_money.amount]));
   let subtotal=0,totalDiscount=0,tax=0;
   for(const line of order.line_items){const gross=line.base_price_money.amount*Number(line.quantity),disc=(line.applied_discounts||[]).reduce((a,d)=>a+discounts.get(d.discount_uid),0);subtotal+=gross;totalDiscount+=disc;if(line.applied_taxes?.length)tax+=Math.round((gross-disc)*8.25/100);}
   return {total_tax_money:{amount:tax},total_discount_money:{amount:totalDiscount},total_money:{amount:subtotal-totalDiscount+tax}};
  }
  if(url.endsWith('/v2/orders/calculate'))return reply({order:{...amounts(body.order),...(options.badSquare?{total_discount_money:{amount:0}}:{})}});
  if(url.endsWith('/v2/online-checkout/payment-links')){events.push('square');return reply({payment_link:{id:'link',order_id:'square-order',url:'https://square.test/pay'},related_resources:{orders:[amounts(body.order)]}});}
  throw new Error('Unexpected call '+url);
 };
 const payload={items:[{sku:'FOOD',qty:1,price:0.01},{sku:'HOME',qty:1}],customer:{...customer,...options.customer},acceptedTerms:true,fulfillmentType:'delivery',promotionCode:options.noPromo?null:'BIENVENIDO10',discountCents:999999};
 const event={httpMethod:'POST',headers:{origin:'https://myraices.com',...(options.noAuth?{}:{authorization:'Bearer test-user-token'})},body:JSON.stringify(payload)};
 try {const r=await handler(event);return {result:JSON.parse(r.body),status:r.statusCode,calls,events};}finally{global.fetch=originalFetch;}
}
test('authenticated first purchase uses trusted prices, discounted tax, excluded delivery and persists discount',async()=>{
 const r=await run();assert.equal(r.status,200);assert.equal(r.result.discountCents,500);assert.equal(r.result.totalCents,5190);
 const square=r.calls.find(c=>c.url.endsWith('/payment-links')).body;
 assert.equal(square.order.line_items[2].base_price_money.amount,500);assert.equal(square.order.line_items[2].applied_discounts,undefined);
 assert.equal(square.order.line_items[0].base_price_money.amount,3000);assert.equal(square.checkout_options.enable_coupon,false);
 const session=r.calls.find(c=>c.url.endsWith('/checkout_sessions')&&c.method==='POST').body;
 assert.equal(session.payload.order.discount_amount,5);assert.equal(session.payload.order.promotion_code,'BIENVENIDO10');assert.equal(session.payload.order.promotion_user_id,userId);
 assert.ok(r.events.indexOf('reserve')<r.events.indexOf('square'));
});
test('ordinary checkout remains available without login or promotion',async()=>{const r=await run({noPromo:true,noAuth:true});assert.equal(r.status,200);assert.equal(r.result.discountCents,0);assert.equal(r.result.totalCents,5706);assert.ok(!r.events.includes('reserve'));});
test('first purchase denies unauthenticated buyers and email substitution',async()=>{
 let r=await run({noAuth:true});assert.equal(r.result.error,'PROMO_LOGIN_REQUIRED');assert.ok(!r.events.includes('square'));
 r=await run({customer:{email:'another@example.com'}});assert.equal(r.result.error,'PROMO_EMAIL_MISMATCH');assert.ok(!r.events.includes('square'));
});
test('previous purchases and already pending discounted payments are rejected',async()=>{
 for(const [state,error] of [[{eligible:false,pending:false},'PROMO_NOT_FIRST_PURCHASE'],[{eligible:true,pending:true},'PROMO_PENDING_CHECKOUT']]){const r=await run({state});assert.equal(r.result.error,error);assert.ok(!r.events.includes('square'));}
});
test('atomic reservation refuses racing attempts before any payment link is issued',async()=>{const r=await run({reserveError:'PROMO_PENDING_CHECKOUT'});assert.equal(r.result.error,'PROMO_PENDING_CHECKOUT');assert.ok(!r.events.includes('square'));});
test('Square discount mismatch blocks checkout',async()=>{const r=await run({badSquare:true});assert.equal(r.result.error,'PROMO_CALCULATION_MISMATCH');assert.ok(!r.events.includes('square'));});
test('future general-purpose codes can be used without logging in',async()=>{const r=await run({promotion:{first_purchase_only:false},noAuth:true});assert.equal(r.status,200);assert.equal(r.result.discountCents,500);});
test('a pending checkout is released only after Square confirms cancellation',async()=>{
 const {handler:cancel}=require('../netlify/functions/cancel-promotion-checkout');
 for(const alreadyPaid of [false,true]){
  let cancelled=false,released=false;
  global.fetch=async(url,init={})=>{
   if(url.endsWith('/auth/v1/user'))return reply({id:userId,email:'buyer@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'});
   if(url.includes('/promotion_redemptions?')&&init.method!=='PATCH')return reply([{session_id:'s'}]);
   if(url.includes('/checkout_sessions?')&&init.method!=='PATCH')return reply([{square_payment_link_id:'link',square_order_id:'order'}]);
   if(url.includes('/v2/orders/'))return reply({order:{state:alreadyPaid?'COMPLETED':cancelled?'CANCELED':'OPEN'}});
   if(url.includes('/payment-links/')){cancelled=true;return reply({});}
   if(url.includes('/promotion_redemptions?')&&init.method==='PATCH'){assert.ok(cancelled);released=true;return reply({});}
   if(url.includes('/checkout_sessions?')&&init.method==='PATCH')return reply({});
   throw new Error('Unexpected '+url);
  };
  try{
   const r=await cancel({httpMethod:'POST',headers:{authorization:'Bearer qa'},body:'{}'});
   assert.equal(r.statusCode,alreadyPaid?409:200);assert.equal(released,!alreadyPaid);assert.equal(cancelled,!alreadyPaid);
  }finally{global.fetch=originalFetch;}
 }
});
