const {loadPromotion,calculatePromotion,firstPurchaseCustomer} = require('./promotion-engine');
async function request(path, options={}) {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=process.env.SUPABASE_URL || 'https://tqtnffinhqbyesjdollk.supabase.co';
  if(!key)throw new Error('PROMO_UNAVAILABLE');
  const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'}});
  if(!r.ok)throw new Error('PROMO_UNAVAILABLE');
  return r.json();
}
exports.handler=async event=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  const result=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
  if(event.httpMethod!=='POST')return result(405,{error:'METHOD_NOT_ALLOWED'});
  try {
    let body;try{body=JSON.parse(event.body||'{}');}catch{return result(400,{error:'INVALID_REQUEST'});}
    if(!Array.isArray(body.items)||!body.items.length||body.items.length>100)return result(400,{error:'EMPTY_CART'});
    const products=await request('products?select=sku,price,status&status=eq.active');
    const map=new Map(products.map(p=>[p.sku,p]));
    const items=body.items.map(i=>{
      const p=map.get(String(i.sku||'').trim());
      const qty=Math.max(1,Math.min(20,Number.parseInt(i.qty,10)||0));
      if(!p)throw new Error('PRODUCT_NOT_AVAILABLE');
      return {unitCents:Math.round(Number(p.price)*100),qty};
    });
    const {promo,used}=await loadPromotion(body.code,request);
    await firstPurchaseCustomer(promo,event,request);
    const p=calculatePromotion(promo,items,used);
    return result(200,{code:p.code,discountCents:p.discountCents,subtotalCents:p.subtotalCents,minimumCents:p.minimumCents});
  }catch(e){const known=/^(PROMO_|EMPTY_CART|PRODUCT_NOT_AVAILABLE)/.test(e.message);return result(e.message==='PROMO_UNAVAILABLE'?503:400,{error:known?e.message:'PROMO_UNAVAILABLE'});}
};
