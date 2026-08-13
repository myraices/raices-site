const crypto = require('crypto');

const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type',
  'access-control-allow-methods':'GET,POST,OPTIONS'
};
const reply=(statusCode,body)=>({statusCode,headers:HEADERS,body:JSON.stringify(body)});
const cfg=()=>{
  const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  return {url,key};
};
async function rest(path,options={}){
  const {url,key}=cfg();
  const res=await fetch(`${url}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',...(options.headers||{})}
  });
  const text=await res.text();
  if(!res.ok) throw new Error(`SUPABASE_${res.status}:${text.slice(0,500)}`);
  return text?JSON.parse(text):null;
}
const clean=v=>String(v||'').trim();
const lower=v=>clean(v).toLowerCase();
const money=n=>`$${Number(n||0).toFixed(2)}`;
function isHome(collection){return lower(collection)==='home';}
function deliveryTimestamp(order,delivery){return delivery?.delivered_at||order?.completed_at||null;}
function daysSince(iso){if(!iso)return Infinity;return (Date.now()-new Date(iso).getTime())/86400000;}

async function loadOrder(token){
  if(!/^[0-9a-f-]{36}$/i.test(clean(token))) return null;
  const rows=await rest(`orders?manage_token=eq.${encodeURIComponent(token)}&select=id,order_number,customer_name,customer_email,fulfillment_type,status,payment_status,subtotal,delivery_amount,tax_amount,total_amount,refunded_amount,created_at,completed_at,cancellation_requested_at,order_items(id,product_id,product_name,sku,quantity,unit_price,line_total)&limit=1`);
  const order=rows?.[0];
  if(!order)return null;
  const deliveryRows=await rest(`deliveries?order_id=eq.${encodeURIComponent(order.id)}&select=id,status,departed_at,delivered_at&order=created_at.desc&limit=1`).catch(()=>[]);
  const delivery=deliveryRows?.[0]||null;
  const stops=await rest(`delivery_route_stops?order_id=eq.${encodeURIComponent(order.id)}&select=id,route_id,loaded_at,delivery_routes(status)&order=created_at.desc`).catch(()=>[]);
  const productIds=[...new Set((order.order_items||[]).map(i=>i.product_id).filter(Boolean))];
  let productMap=new Map();
  if(productIds.length){
    const products=await rest(`products?id=in.(${productIds.join(',')})&select=id,collection,category,operational_type,product_type`).catch(()=>[]);
    productMap=new Map((products||[]).map(p=>[String(p.id),p]));
  }
  const items=(order.order_items||[]).map(item=>{
    const p=productMap.get(String(item.product_id))||{};
    return {...item,collection:p.collection||'',category:p.category||'',operational_type:p.operational_type||'',is_home:isHome(p.collection)};
  });
  const routeStatuses=(stops||[]).map(s=>lower(s.delivery_routes?.status)).filter(Boolean);
  const routeActive=routeStatuses.some(status=>['active','started','in_progress','out_for_delivery'].includes(status));
  const routeLoading=routeStatuses.some(status=>['planned','loading'].includes(status));
  const deliveryStatus=lower(delivery?.status||order.status);
  const departed=Boolean(delivery?.departed_at);
  const deliveredAt=deliveryTimestamp(order,delivery);
  const digital=lower(order.fulfillment_type)==='digital';
  const cancellationEligible=!digital
    && ['completed','partially_refunded'].includes(lower(order.payment_status))
    && !['cancelled','out_for_delivery','delivered','completed'].includes(deliveryStatus)
    && !departed
    && !routeActive;
  const delivered=['delivered','completed'].includes(deliveryStatus)||Boolean(deliveredAt);
  const withinReturnWindow=delivered && daysSince(deliveredAt)<=14.0001;
  const requests=await rest(`post_sale_requests?order_id=eq.${encodeURIComponent(order.id)}&select=id,request_type,status,reason,customer_note,created_at,updated_at,return_deadline,resolution,rejection_reason,approved_amount&order=created_at.desc`).catch(()=>[]);
  return {order:{...order,order_items:items},delivery,stops,routeActive,routeLoading,cancellationEligible,delivered,deliveredAt,withinReturnWindow,requests:requests||[]};
}
async function event(requestId,type,note,metadata={}){
  await rest('post_sale_events',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({request_id:requestId,actor_type:'customer',event_type:type,note:note||null,metadata})});
}
async function appNotification(order,request){
  const payload={type:'post_sale_request',title:'Nueva solicitud postventa',message:`#${order.order_number||String(order.id).slice(0,8)} · ${request.request_type}`,order_id:order.id,action_url:'/post-sale',dedupe_key:`post-sale:${request.id}`,metadata:{request_id:request.id,request_type:request.request_type}};
  await rest('app_notifications',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)}).catch(()=>null);
}
async function sendAcknowledgement(order,kind,requestId){
  const apiKey=process.env.BREVO_API_KEY;
  if(!apiKey||!order.customer_email)return;
  const es={cancellation:['Solicitud de cancelación recibida','Recibimos tu solicitud de cancelación. El pedido no se considera cancelado hasta que Raíces confirme la solicitud y, cuando corresponda, el reembolso.'],home_return:['Solicitud de devolución recibida','Recibimos tu solicitud de devolución Home. La revisaremos y te enviaremos las instrucciones de devolución si es aprobada.'],issue:['Incidencia recibida','Recibimos tu reporte y la evidencia enviada. Nuestro equipo revisará el caso antes de determinar la resolución.']}[kind];
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#173d38"><h2>${es[0]}</h2><p>Hola ${clean(order.customer_name)||' '},</p><p>${es[1]}</p><p><strong>Pedido #${clean(order.order_number)}</strong><br>Caso: ${requestId}</p><p>Te avisaremos por email cuando haya una actualización.</p></div>`;
  const res=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{accept:'application/json','content-type':'application/json','api-key':apiKey},body:JSON.stringify({sender:{name:process.env.BREVO_SENDER_NAME||'Raíces',email:process.env.BREVO_SENDER_EMAIL||'info@myraices.com'},to:[{email:order.customer_email,name:order.customer_name||order.customer_email}],subject:`${es[0]} · Pedido #${clean(order.order_number)}`,htmlContent:html})});
  if(!res.ok)console.warn('post-sale acknowledgement failed',res.status,await res.text());
}
async function uploadEvidence(requestId,images){
  const {url,key}=cfg();
  const saved=[];
  for(const image of (images||[]).slice(0,4)){
    const mime=lower(image.mime||'image/jpeg');
    if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('IMAGE_TYPE_NOT_ALLOWED');
    const data=String(image.data||'').replace(/^data:[^;]+;base64,/, '');
    const buffer=Buffer.from(data,'base64');
    if(!buffer.length||buffer.length>8*1024*1024)throw new Error('IMAGE_SIZE_INVALID');
    const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
    const path=`${requestId}/${crypto.randomUUID()}.${ext}`;
    const res=await fetch(`${url}/storage/v1/object/post-sale-evidence/${path}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':mime,'x-upsert':'false'},body:buffer});
    if(!res.ok)throw new Error(`EVIDENCE_UPLOAD_${res.status}:${await res.text()}`);
    await rest('post_sale_evidence',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({request_id:requestId,storage_path:path,mime_type:mime})});
    saved.push(path);
  }
  return saved;
}
async function cancellationStillAvailable(order){
  // Authoritative last-moment gate. Use only fields known to exist so a schema
  // mismatch cannot silently reopen cancellation once delivery has departed.
  const deliveryRows=await rest(
    `deliveries?order_id=eq.${encodeURIComponent(order.id)}&select=id,status,departed_at,delivered_at&order=created_at.desc&limit=1`
  ).catch(()=>[]);
  const currentDelivery=deliveryRows?.[0]||null;
  const currentStops=await rest(
    `delivery_route_stops?order_id=eq.${encodeURIComponent(order.id)}&select=id,route_id,loaded_at,delivery_routes(status)&order=created_at.desc`
  ).catch(()=>[]);
  const deliveryStatus=lower(currentDelivery?.status||order.status);
  const routeStatuses=(currentStops||[]).map(stop=>lower(stop.delivery_routes?.status)).filter(Boolean);
  const routeStarted=routeStatuses.some(status=>['active','started','in_progress','out_for_delivery','completed'].includes(status));
  const departed=Boolean(currentDelivery?.departed_at);
  return !departed
    && !routeStarted
    && !['cancelled','out_for_delivery','delivered','completed'].includes(deliveryStatus);
}

async function createRequest(state,body){
  const {order,delivery,stops}=state;
  const type=clean(body.request_type);
  const selectedIds=[...new Set((body.order_item_ids||[]).map(String))];
  const selected=(order.order_items||[]).filter(i=>selectedIds.includes(String(i.id)));
  if(!['cancellation','home_return','issue'].includes(type))return reply(400,{error:'INVALID_REQUEST_TYPE'});
  if(type!=='cancellation'&&!selected.length)return reply(400,{error:'SELECT_ITEMS'});
  const open=(state.requests||[]).find(r=>r.request_type===type&&!['rejected','closed','cancelled','expired','refunded','replacement'].includes(r.status));
  if(open)return reply(409,{error:'REQUEST_ALREADY_OPEN',request:open});

  if(type==='cancellation'){
    if(!state.cancellationEligible)return reply(409,{error:'CANCELLATION_NOT_AVAILABLE'});
    // Re-check immediately before creating the case. This prevents a customer
    // from submitting a cancellation from a page opened before the route started.
    if(!(await cancellationStillAvailable(order))){
      return reply(409,{error:'CANCELLATION_NOT_AVAILABLE',reason:'ORDER_ALREADY_OUT_FOR_DELIVERY'});
    }
  }
  if(type==='home_return'){
    if(!state.withinReturnWindow)return reply(409,{error:'RETURN_WINDOW_CLOSED'});
    if(selected.some(i=>!i.is_home))return reply(409,{error:'HOME_ONLY_RETURN'});
  }
  if(type==='issue'&&!state.delivered)return reply(409,{error:'ISSUE_AFTER_DELIVERY'});

  const reason=clean(body.reason).slice(0,120);
  const note=clean(body.customer_note).slice(0,1800);
  if(type==='cancellation'){
    const allowed=new Set(['change_mind','ordered_by_mistake','duplicate_order','change_items','delivery_timing','other']);
    if(!allowed.has(reason))return reply(400,{error:'INVALID_CANCELLATION_REASON'});
    if(reason==='other'&&!note)return reply(400,{error:'CANCELLATION_NOTE_REQUIRED'});
  }
  const needPhoto=type==='issue'&&['damaged','broken'].includes(lower(reason));
  if(needPhoto&&!(body.images||[]).length)return reply(400,{error:'PHOTO_REQUIRED'});

  const returnDeadline=type==='home_return'&&state.deliveredAt?new Date(new Date(state.deliveredAt).getTime()+14*86400000).toISOString().slice(0,10):null;
  const inserted=await rest('post_sale_requests',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({order_id:order.id,customer_email:lower(order.customer_email),request_type:type,status:'pending',reason:reason||null,customer_note:note||null,return_deadline:returnDeadline})});
  const request=inserted?.[0];
  if(!request)throw new Error('REQUEST_INSERT_FAILED');
  if(selected.length){
    await rest('post_sale_request_items',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(selected.map(i=>({request_id:request.id,order_item_id:i.id,quantity:Number(i.quantity||1),requested_amount:Number(i.line_total||0)})))});
  }
  if((body.images||[]).length)await uploadEvidence(request.id,body.images);
  await event(request.id,'created',note||reason,{request_type:type});

  if(type==='cancellation'){
    await rest(`orders?id=eq.${encodeURIComponent(order.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({cancellation_requested_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
    // If it was only planned/loading, remove it from that route so it cannot depart while pending review.
    for(const stop of (stops||[])){
      const routeStatus=lower(stop.delivery_routes?.status);
      if(['planned','loading'].includes(routeStatus)){
        await rest(`delivery_route_stops?id=eq.${encodeURIComponent(stop.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>null);
      }
    }
  }
  await appNotification(order,request);
  await sendAcknowledgement(order,type,request.id);
  return reply(201,{ok:true,request:{id:request.id,type,status:'pending'}});
}

exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:HEADERS,body:''};
  try{
    if(event.httpMethod==='GET'){
      const token=clean(event.queryStringParameters?.token);
      const state=await loadOrder(token);
      if(!state)return reply(404,{error:'ORDER_NOT_FOUND'});
      return reply(200,{ok:true,...state});
    }
    if(event.httpMethod==='POST'){
      const body=JSON.parse(event.body||'{}');
      const state=await loadOrder(body.token);
      if(!state)return reply(404,{error:'ORDER_NOT_FOUND'});
      return createRequest(state,body);
    }
    return reply(405,{error:'METHOD_NOT_ALLOWED'});
  }catch(err){console.error('post-sale-request',err);return reply(500,{error:'POST_SALE_UNAVAILABLE',detail:err.message});}
};
