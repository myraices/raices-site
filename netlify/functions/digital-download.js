const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
function response(statusCode,body){return{statusCode,headers:JSON_HEADERS,body:JSON.stringify(body)}}
function cfg(){const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co';const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');return{url,key}}
async function request(path,opts={}){const{url,key}=cfg();const r=await fetch(`${url}${path}`,{...opts,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(opts.headers||{})}});const text=await r.text();if(!r.ok)throw new Error(`SUPABASE_${r.status}:${text.slice(0,300)}`);return text?JSON.parse(text):null}
function encPath(path){return String(path||'').split('/').map(encodeURIComponent).join('/')}
exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return response(405,{error:'METHOD_NOT_ALLOWED'});
 try{
  const token=String(event.queryStringParameters?.token||'').trim();if(!/^[0-9a-f-]{36}$/i.test(token))return response(400,{error:'INVALID_DOWNLOAD_TOKEN'});
  const ent=(await request(`/rest/v1/digital_entitlements?download_token=eq.${encodeURIComponent(token)}&select=id,order_id,product_id,revoked_at&limit=1`))?.[0];
  if(!ent||ent.revoked_at)return response(404,{error:'DOWNLOAD_NOT_AVAILABLE'});
  const order=(await request(`/rest/v1/orders?id=eq.${encodeURIComponent(ent.order_id)}&select=id,status,payment_status,refunded_amount,total_amount&limit=1`))?.[0];
  const paid=String(order?.payment_status||'').toLowerCase()==='completed';const blocked=['refunded','cancelled','canceled'].includes(String(order?.status||'').toLowerCase());
  if(!paid||blocked||Number(order?.refunded_amount||0)>=Number(order?.total_amount||0))return response(403,{error:'ORDER_NOT_ELIGIBLE'});
  const product=(await request(`/rest/v1/products?id=eq.${encodeURIComponent(ent.product_id)}&select=digital_file_path,digital_file_name&limit=1`))?.[0];
  if(!product?.digital_file_path)return response(404,{error:'DIGITAL_FILE_MISSING'});
  const {url,key}=cfg();const sign=await fetch(`${url}/storage/v1/object/sign/digital-products/${encPath(product.digital_file_path)}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});
  const data=await sign.json().catch(()=>({}));if(!sign.ok||!data.signedURL)throw new Error(`SIGN_${sign.status}`);
  await request(`/rest/v1/digital_entitlements?id=eq.${encodeURIComponent(ent.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_download_at:new Date().toISOString()})}).catch(()=>{});
  const signed=data.signedURL.startsWith('http')?data.signedURL:`${url}/storage/v1${data.signedURL}`;
  return{statusCode:302,headers:{Location:signed,'Cache-Control':'no-store'},body:''};
 }catch(err){console.error('digital-download',err);return response(500,{error:'DOWNLOAD_UNAVAILABLE'});}
};
