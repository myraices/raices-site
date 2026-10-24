const {verifiedCustomer}=require('./promotion-engine');
exports.handler=async event=>{
 const result=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
 if(event.httpMethod!=='POST')return result(405,{error:'METHOD_NOT_ALLOWED'});
 try{
  const user=await verifiedCustomer(event);
  const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co',key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const environment=String(process.env.SQUARE_ENVIRONMENT||'sandbox').toLowerCase();
  async function request(path,options={}){
   const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'}});
   if(!r.ok)throw new Error('PROMO_UNAVAILABLE');
   const t=await r.text();return t?JSON.parse(t):[];
  }
  const rows=await request(`promotion_redemptions?user_id=eq.${user.id}&environment=eq.${environment}&first_only=eq.true&state=eq.reserved&select=session_id&limit=1`);
  if(!rows.length)return result(200,{cancelled:true});
  const id=rows[0].session_id;
  const sessions=await request(`checkout_sessions?id=eq.${id}&select=id,square_payment_link_id,square_order_id,environment&limit=1`);
  const s=sessions[0];
  // No known link may mean an in-flight or ambiguous Square request: never release it blindly.
  if(!s?.square_payment_link_id||!s.square_order_id)throw new Error('PROMO_PENDING_REVIEW');
  const base=environment==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
  const headers={Authorization:`Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,'Square-Version':'2026-07-15'};
  async function order(){const r=await fetch(`${base}/v2/orders/${encodeURIComponent(s.square_order_id)}`,{headers});if(!r.ok)throw new Error('PROMO_UNAVAILABLE');return (await r.json()).order;}
  let o=await order();
  if(o.state==='COMPLETED'||o.tenders?.length)throw new Error('PROMO_PAYMENT_PROCESSING');
  if(o.state!=='CANCELED'){
   const r=await fetch(`${base}/v2/online-checkout/payment-links/${encodeURIComponent(s.square_payment_link_id)}`,{method:'DELETE',headers});
   if(!r.ok)throw new Error('PROMO_PAYMENT_PROCESSING');
   o=await order();
  }
  if(o.state!=='CANCELED'||o.tenders?.length)throw new Error('PROMO_PAYMENT_PROCESSING');
  await request(`promotion_redemptions?session_id=eq.${id}&state=eq.reserved`,{method:'PATCH',body:JSON.stringify({state:'released'})});
  await request(`checkout_sessions?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status:'failed',updated_at:new Date().toISOString()})});
  return result(200,{cancelled:true});
 }catch(e){return result(409,{error:/^PROMO_/.test(e.message)?e.message:'PROMO_UNAVAILABLE'});}
};
