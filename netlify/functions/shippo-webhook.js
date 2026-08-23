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
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function statusDescription(data){
  return String(data?.tracking_status?.status_details||data?.tracking_status?.status||data?.status_details||'').trim();
}
async function preferredLanguage(c,email){
  if(!email)return'es';
  const rows=await rest(c,`marketing_subscribers?email=ilike.${encodeURIComponent(email)}&select=preferred_language&limit=1`).catch(()=>[]);
  return String(rows?.[0]?.preferred_language||'es').toLowerCase().startsWith('en')?'en':'es';
}
async function sendTrackingEmail({c,order,shipment,status,notifications}){
  if(!order?.customer_email||!['in_transit','delivered'].includes(status))return notifications;
  const key=status==='in_transit'?'in_transit_sent_at':'delivered_sent_at';
  if(notifications?.[key])return notifications;

  const apiKey=process.env.BREVO_API_KEY;
  if(!apiKey){
    console.warn('[shippo-webhook] tracking_email_skipped BREVO_API_KEY_MISSING');
    return notifications;
  }
  const lang=await preferredLanguage(c,order.customer_email);
  const number=order.order_number||String(order.id||'').slice(0,8);
  const tracking=shipment.tracking_number||'';
  const provider=shipment.provider||'Shipping';
  const service=shipment.service||'';
  const trackUrl=shipment.tracking_url||'';
  const firstName=String(order.customer_name||'').trim().split(/\s+/)[0]||'';

  const isDelivered=status==='delivered';
  const subject=lang==='en'
    ? `${isDelivered?'Your order was delivered':'Your order is on the way'} · #${number}`
    : `${isDelivered?'Tu pedido fue entregado':'Tu pedido va en camino'} · #${number}`;
  const heading=lang==='en'
    ? (isDelivered?'Your order was delivered':'Your order is on the way')
    : (isDelivered?'Tu pedido fue entregado':'Tu pedido va en camino');
  const intro=lang==='en'
    ? (isDelivered
      ? `Your Raíces order #${number} was reported as delivered by ${provider}.`
      : `Your Raíces order #${number} has been shipped and is now in transit.`)
    : (isDelivered
      ? `Tu pedido Raíces #${number} fue reportado como entregado por ${provider}.`
      : `Tu pedido Raíces #${number} ya fue enviado y se encuentra en tránsito.`);
  const trackingLabel=lang==='en'?'Tracking':'Tracking';
  const serviceLabel=lang==='en'?'Service':'Servicio';
  const buttonLabel=lang==='en'?'Track package':'Rastrear paquete';
  const footer=lang==='en'
    ? 'Thank you for choosing Raíces.'
    : 'Gracias por elegir Raíces.';

  const html=`<!doctype html><html><body style="margin:0;background:#f5f4ef;font-family:Arial,Helvetica,sans-serif;color:#173d38">
    <div style="max-width:620px;margin:0 auto;padding:32px 18px">
      <div style="background:#fff;border:1px solid #deded7;border-radius:24px;padding:34px">
        <p style="margin:0 0 10px;text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#6c746b">RAÍCES · SHIPPING</p>
        <h1 style="margin:0 0 18px;font-size:30px;line-height:1.15;color:#173d38">${esc(heading)}</h1>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.7">Hola${firstName?` ${esc(firstName)}`:''},</p>
        <p style="margin:0 0 22px;font-size:16px;line-height:1.7">${esc(intro)}</p>
        <div style="background:#f7f4ec;border-radius:16px;padding:18px;margin:0 0 22px">
          <p style="margin:0 0 8px"><strong>${esc(provider)}${service?` · ${esc(service)}`:''}</strong></p>
          ${tracking?`<p style="margin:0 0 7px">${esc(trackingLabel)}: <strong>${esc(tracking)}</strong></p>`:''}
          ${service?`<p style="margin:0">${esc(serviceLabel)}: ${esc(service)}</p>`:''}
        </div>
        ${trackUrl?`<a href="${esc(trackUrl)}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#174f45;color:#fff;text-decoration:none;font-weight:700">${esc(buttonLabel)}</a>`:''}
        <p style="margin:28px 0 0;font-size:14px;color:#6c746b">${esc(footer)}<br>myraices.com</p>
      </div>
    </div></body></html>`;

  const res=await fetch('https://api.brevo.com/v3/smtp/email',{
    method:'POST',
    headers:{accept:'application/json','content-type':'application/json','api-key':apiKey},
    body:JSON.stringify({
      sender:{name:process.env.BREVO_SENDER_NAME||'Raíces',email:process.env.BREVO_SENDER_EMAIL||'info@myraices.com'},
      to:[{email:order.customer_email,name:order.customer_name||order.customer_email}],
      subject,htmlContent:html
    })
  });
  if(!res.ok){
    console.warn('[shippo-webhook] tracking_email_failed',res.status,(await res.text()).slice(0,300));
    return notifications;
  }
  return {...notifications,[key]:new Date().toISOString()};
}
async function createInternalAlert(c,order,shipment,status,data){
  if(!['exception','returned'].includes(status)||!order?.id)return;
  const number=order.order_number||String(order.id).slice(0,8);
  const title=status==='returned'?'Shipping devuelto':'Excepción de Shipping';
  const detail=statusDescription(data);
  const payload={
    type:'shipping_exception',
    title,
    message:`#${number} · ${shipment.provider||'Carrier'}${detail?` · ${detail}`:''}`,
    order_id:order.id,
    action_url:`/orders?order=${order.id}`,
    dedupe_key:`shipping:${status}:${shipment.id}:${String(data?.tracking_status?.status_date||data?.status_date||'current')}`,
    metadata:{shipment_id:shipment.id,tracking_number:shipment.tracking_number||null,status,detail:detail||null}
  };
  await rest(c,'app_notifications',{
    method:'POST',
    headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},
    body:JSON.stringify(payload)
  }).catch(err=>console.warn('[shippo-webhook] app_notification_failed',err.message));
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

    const rows=await rest(c,`order_shipments?tracking_number=eq.${encodeURIComponent(tracking)}&select=id,order_id,provider,service,shipment_status,tracking_number,tracking_url,tracking_payload&limit=1`);
    const shipment=rows?.[0];
    if(!shipment)return json(200,{ok:true,ignored:true,reason:'UNKNOWN_TRACKING'});

    const status=trackingStatus(data);
    const now=new Date().toISOString();
    const previousPayload=shipment.tracking_payload&&typeof shipment.tracking_payload==='object'?shipment.tracking_payload:{};
    let notifications=previousPayload?._raices_notifications||{};

    const orders=await rest(c,`orders?id=eq.${encodeURIComponent(shipment.order_id)}&select=id,order_number,status,customer_name,customer_email&limit=1`);
    const order=orders?.[0]||null;

    notifications=await sendTrackingEmail({c,order,shipment,status,notifications});
    await createInternalAlert(c,order,shipment,status,data);

    const update={
      last_tracking_at:now,
      tracking_payload:{shippo:data,_raices_notifications:notifications},
      updated_at:now
    };
    if(status)update.shipment_status=status;
    if(status==='in_transit'&&!previousPayload?.shipped_at)update.shipped_at=now;
    if(status==='delivered')update.delivered_at=now;
    await rest(c,`order_shipments?id=eq.${encodeURIComponent(shipment.id)}`,{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(update)
    });

    if(status==='delivered'&&order&&order.status!=='completed'){
      await rest(c,`orders?id=eq.${encodeURIComponent(order.id)}`,{
        method:'PATCH',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({status:'completed',completed_at:now,updated_at:now})
      });
      await rest(c,'order_status_history',{
        method:'POST',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({
          order_id:order.id,from_status:order.status||'paid',to_status:'completed',
          note:`Shipping entregado automáticamente por tracking ${tracking}.`,changed_at:now
        })
      }).catch(()=>null);
    }
    return json(200,{ok:true,status:status||'unchanged'});
  }catch(err){
    console.error('[shippo-webhook]',err);
    return json(500,{error:'WEBHOOK_FAILED'});
  }
};
