const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
function response(statusCode,body){return{statusCode,headers:JSON_HEADERS,body:JSON.stringify(body)}}
async function serviceRequest(path){
  const base=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  const res=await fetch(`${base}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  const text=await res.text(); if(!res.ok) throw new Error(`SUPABASE_${res.status}:${text.slice(0,250)}`); return text?JSON.parse(text):[];
}
exports.handler=async(event)=>{
  if(event.httpMethod!=='GET')return response(405,{error:'METHOD_NOT_ALLOWED'});
  try{
    const token=String(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return response(401,{error:'UNAUTHORIZED'});
    const base=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co';
    const anon=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW';
    const userRes=await fetch(`${base}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
    if(!userRes.ok)return response(401,{error:'UNAUTHORIZED'});
    const user=await userRes.json(); const email=String(user.email||'').trim().toLowerCase();
    if(!email)return response(200,{orders:[]});
    const encoded=encodeURIComponent(email);
    const orders=await serviceRequest(`orders?select=id,order_number,status,payment_status,total_cents,created_at,fulfillment_type&customer_email=eq.${encoded}&order=created_at.desc&limit=50`);
    if(!orders.length)return response(200,{orders:[]});
    const ids=orders.map(o=>o.id).filter(Boolean);
    const items=await serviceRequest(`order_items?select=order_id,sku,product_name,variant,quantity,line_total_cents&order_id=in.(${ids.join(',')})&order=created_at.asc`);
    const byOrder=new Map(); for(const item of items){if(!byOrder.has(item.order_id))byOrder.set(item.order_id,[]);byOrder.get(item.order_id).push(item)}
    return response(200,{orders:orders.map(o=>({...o,items:byOrder.get(o.id)||[]}))});
  }catch(err){console.error('customer-orders',err);return response(500,{error:'ORDERS_UNAVAILABLE'});}
};
