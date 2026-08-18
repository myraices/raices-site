const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return{statusCode:405,headers:JSON_HEADERS,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
 const id=String(event.queryStringParameters?.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return{statusCode:400,headers:JSON_HEADERS,body:JSON.stringify({error:'INVALID_REFERENCE'})};
 try{
  const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co',key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  const fetchOrder=async(orderId)=>{
   const r=await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,status,payment_status,total_cents,delivery_zone,created_at`,{headers});
   const d=await r.json().catch(()=>[]);
   return r.ok&&d?.[0]?d[0]:null;
  };
  const direct=await fetchOrder(id);
  if(direct)return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(direct)};
  const sr=await fetch(`${url}/rest/v1/checkout_sessions?id=eq.${encodeURIComponent(id)}&select=id,status,order_id,expires_at,created_at&limit=1`,{headers});
  const sessions=await sr.json().catch(()=>[]);
  const session=sr.ok?sessions?.[0]:null;
  if(!session)return{statusCode:404,headers:JSON_HEADERS,body:JSON.stringify({error:'REFERENCE_NOT_FOUND'})};
  if(session.order_id){
   const created=await fetchOrder(session.order_id);
   if(created)return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(created)};
  }
  const failed=['failed','expired'].includes(String(session.status||'').toLowerCase());
  return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify({
   checkout_id:session.id,
   status:failed?'payment_failed':'processing',
   payment_status:failed?'failed':'processing',
   order_created:false,
   created_at:session.created_at
  })};
 }catch(e){
  console.error('order-status',e);
  return{statusCode:500,headers:JSON_HEADERS,body:JSON.stringify({error:'STATUS_UNAVAILABLE'})}
 }
};
