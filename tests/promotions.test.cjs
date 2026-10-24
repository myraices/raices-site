const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeCode,calculatePromotion,squareDiscounts,firstPurchaseCustomer}=require('../netlify/functions/promotion-engine');
const {calculateManualTax}=require('../netlify/functions/tax-engine');
const promo={id:'p',code:'BIENVENIDO10',active:true,discount_type:'percentage',value:10,minimum_cents:0};
const items=[{unitCents:1999,qty:3},{unitCents:1451,qty:1}];
test('BIENVENIDO10 gives an exact 10% and allocates cents without losing money',()=>{
 const p=calculatePromotion(promo,items);assert.equal(p.subtotalCents,7448);assert.equal(p.discountCents,745);assert.equal(p.allocations.reduce((a,b)=>a+b,0),745);
 assert.deepEqual(p.allocations,[600,145]);assert.equal(normalizeCode(' bienvenido10 '),'BIENVENIDO10');
});
test('fixed discounts are capped at product subtotal; shipping never enters allocations',()=>{
 const p=calculatePromotion({...promo,discount_type:'fixed',value:100},items);
 assert.equal(p.discountCents,7448);assert.deepEqual(p.allocations,[5997,1451]);assert.equal(squareDiscounts(p).length,2);assert.ok(squareDiscounts(p).every(d=>d.scope==='LINE_ITEM'));
});
test('random baskets preserve exact discount and nonnegative net line amounts',()=>{
 let seed=47;const random=()=>{seed=(seed*16807)%2147483647;return seed;};
 for(let n=0;n<1000;n++){
  const basket=Array.from({length:1+random()%20},()=>({unitCents:1+random()%20000,qty:1+random()%20}));
  const p=calculatePromotion({...promo,value:0.01+(random()%9999)/100},basket);
  assert.equal(p.allocations.reduce((a,b)=>a+b,0),p.discountCents);
  p.allocations.forEach((a,i)=>assert.ok(a>=0&&a<=basket[i].unitCents*basket[i].qty));
 }
});
test('minimums, inactive, future, expired, invalid and exhausted codes are blocked',()=>{
 for(const [changes,uses,error] of [[{active:false},0,'PROMO_INVALID'],[{minimum_cents:10000},0,'PROMO_MINIMUM'],[{max_uses:1},1,'PROMO_LIMIT_REACHED'],[{starts_on:'2030-01-01'},0,'PROMO_EXPIRED'],[{ends_on:'2020-01-01'},0,'PROMO_EXPIRED'],[{value:101},0,'PROMO_INVALID']])assert.throws(()=>calculatePromotion({...promo,...changes},items,uses),{message:error});
 assert.throws(()=>normalizeCode('x&select=*'),{message:'PROMO_INVALID'});
});
test('campaign dates use Houston time and include the end day',()=>{
 const p={...promo,starts_on:'2026-10-23',ends_on:'2026-10-23'};
 assert.equal(calculatePromotion(p,items,0,new Date('2026-10-24T04:59:00Z')).discountCents,745);
 assert.throws(()=>calculatePromotion(p,items,0,new Date('2026-10-24T05:01:00Z')),{message:'PROMO_EXPIRED'});
});
test('mixed taxable and exempt products reduce only the correct taxable base',()=>{
 const tax=calculateManualTax({customer:{state:'TX'},items:[{unitCents:2000,qty:1,taxStatus:'food_exempt',discountCents:200},{unitCents:1000,qty:2,taxStatus:'physical_taxable',discountCents:200}],deliveryCents:500,salesTax:{states:[{state:'TX',rate:8.25}]}});
 assert.equal(tax.taxableAmountCents,2300);assert.equal(tax.taxCents,190);
});
test('first-purchase promotions require a verified session; general codes do not',async()=>{
 assert.equal(await firstPurchaseCustomer(promo,{},()=>{throw new Error('unexpected')}),null);
 await assert.rejects(firstPurchaseCustomer({...promo,first_purchase_only:true},{headers:{}},()=>{}),{message:'PROMO_LOGIN_REQUIRED'});
});
