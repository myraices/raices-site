const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return{statusCode:405,headers:JSON_HEADERS,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
 const id=String(event.queryStringParameters?.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return{statusCode:400,headers:JSON_HEADERS,body:JSON.stringify({error:'INVALID_ORDER'})};
 try{const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co',key=process.env.SUPABASE_SERVICE_ROLE_KEY;const r=await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=id,order_number,status,payment_status,total_cents,delivery_zone,created_at`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});const d=await r.json();if(!r.ok||!d[0])return{statusCode:404,headers:JSON_HEADERS,body:JSON.stringify({error:'ORDER_NOT_FOUND'})};return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(d[0])}}catch(e){return{statusCode:500,headers:JSON_HEADERS,body:JSON.stringify({error:'STATUS_UNAVAILABLE'})}}
};
