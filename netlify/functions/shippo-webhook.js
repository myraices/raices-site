const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};

function json(statusCode,body){return{statusCode,headers:JSON_HEADERS,body:JSON.stringify(body)}}
function cfg(){
  return{
    url:process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co',
    key:process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret:String(process.env.SHIPPO_WEBHOOK_SECRET||'').trim()
  };
}
async function rest(c,path,options={}){
  const r=await fetch(`${c.url}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(options.headers||{})}
  });
  const text=await r.text();
  if(!r.ok)throw new Error(`SUPABASE_${r.status}:${text.slice(0,500)}`);
  return text?JSON.parse(text):null;
}
function trackingStatus(data){
  const raw=String(data?.tracking_status?.status||data?.tracking_status||data?.status||'').toUpperCase();
  if(raw==='DELIVERED')return'delivered';
  if(['TRANSIT','IN_TRANSIT'].includes(raw))return'in_transit';
  if(['PRE_TRANSIT','UNKNOWN'].includes(raw))return'pre_transit';
  if(['RETURNED'].includes(raw))return'returned';
  if(['FAILURE','ERROR','EXCEPTION'].includes(raw))return'exception';
  return null;
}
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  try{
    const c=cfg();
    if(!c.key)return json(500,{error:'SUPABASE_NOT_CONFIGURED'});
    if(c.secret){
      const supplied=String(event.queryStringParameters?.token||event.headers?.['x-raices-shippo-secret']||'');
      if(supplied!==c.secret)return json(401,{error:'UNAUTHORIZED'});
    }
    const body=JSON.parse(event.body||'{}');
    const eventName=String(body.event||body.type||'').toLowerCase();
    if(!['track_updated','tracking_updated','tracking.update'].includes(eventName))return json(200,{ok:true,ignored:true});
    const data=body.data||body;
    const tracking=String(data.tracking_number||data.tracking||'').trim();
    if(!tracking)return json(200,{ok:true,ignored:true,reason:'NO_TRACKING'});
    const rows=await rest(c,`order_shipments?tracking_number=eq.${encodeURIComponent(tracking)}&select=id,order_id,shipment_status,tracking_number&limit=1`);
    const shipment=rows?.[0];
    if(!shipment)return json(200,{ok:true,ignored:true,reason:'UNKNOWN_TRACKING'});
    const status=trackingStatus(data);
    const now=new Date().toISOString();
    const update={last_tracking_at:now,tracking_payload:data,updated_at:now};
    if(status)update.shipment_status=status;
    if(status==='in_transit'&&!data.shipped_at)update.shipped_at=now;
    if(status==='delivered')update.delivered_at=now;
    await rest(c,`order_shipments?id=eq.${encodeURIComponent(shipment.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(update)});
    if(status==='delivered'){
      const orders=await rest(c,`orders?id=eq.${encodeURIComponent(shipment.order_id)}&select=id,status&limit=1`);
      const order=orders?.[0];
      if(order&&order.status!=='completed'){
        await rest(c,`orders?id=eq.${encodeURIComponent(order.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'completed',completed_at:now,updated_at:now})});
        await rest(c,'order_status_history',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
          order_id:order.id,from_status:order.status||'paid',to_status:'completed',
          note:`Shipping entregado automáticamente por tracking ${tracking}.`,changed_at:now
        })}).catch(()=>null);
      }
    }
    return json(200,{ok:true,status:status||'unchanged'});
  }catch(err){
    console.error('[shippo-webhook]',err);
    return json(500,{error:'WEBHOOK_FAILED'});
  }
};
