const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};

function cfg(){
  return {
    url:process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co',
    key:process.env.SUPABASE_SERVICE_ROLE_KEY,
    squareToken:process.env.SQUARE_ACCESS_TOKEN,
    environment:String(process.env.SQUARE_ENVIRONMENT||'sandbox').toLowerCase()
  };
}
async function fetchJson(url,options={}){
  const r=await fetch(url,options);
  const text=await r.text();
  let body={};try{body=text?JSON.parse(text):{}}catch{}
  return {ok:r.ok,status:r.status,body,text};
}
async function fetchOrder(orderId,c){
  const r=await fetchJson(`${c.url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,status,payment_status,total_cents,delivery_zone,created_at&limit=1`,{
    headers:{apikey:c.key,Authorization:`Bearer ${c.key}`}
  });
  return r.ok?r.body?.[0]||null:null;
}
async function fetchSession(id,c){
  const r=await fetchJson(`${c.url}/rest/v1/checkout_sessions?id=eq.${encodeURIComponent(id)}&select=id,status,order_id,square_order_id,square_payment_link_id,expires_at,created_at&limit=1`,{
    headers:{apikey:c.key,Authorization:`Bearer ${c.key}`}
  });
  return r.ok?r.body?.[0]||null:null;
}
async function squareOrder(squareOrderId,c){
  if(!squareOrderId||!c.squareToken)return null;
  const base=c.environment==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
  const r=await fetchJson(`${base}/v2/orders/${encodeURIComponent(squareOrderId)}`,{
    headers:{Authorization:`Bearer ${c.squareToken}`,'Square-Version':'2026-07-15'}
  });
  return r.ok?r.body?.order||null:null;
}
async function squarePayment(paymentId,c){
  if(!paymentId||!c.squareToken)return null;
  const base=c.environment==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
  const r=await fetchJson(`${base}/v2/payments/${encodeURIComponent(paymentId)}`,{
    headers:{Authorization:`Bearer ${c.squareToken}`,'Square-Version':'2026-07-15'}
  });
  return r.ok?r.body?.payment||null:null;
}
function squareAmounts(order){
  return {
    taxCents:Number(order?.total_tax_money?.amount||order?.net_amounts?.tax_money?.amount||0),
    totalCents:Number(order?.total_money?.amount||order?.net_amounts?.total_money?.amount||0)
  };
}
async function createOrderFromCheckout(session,payment,order,c){
  const amounts=squareAmounts(order);
  const paidAt=payment?.updated_at||payment?.created_at||new Date().toISOString();
  const r=await fetchJson(`${c.url}/rest/v1/rpc/nurai_create_order_from_checkout_session`,{
    method:'POST',
    headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      p_session_id:session.id,
      p_square_order_id:session.square_order_id||payment?.order_id||null,
      p_square_payment_id:payment?.id||null,
      p_paid_at:paidAt,
      p_tax_cents:amounts.taxCents,
      p_total_cents:amounts.totalCents
    })
  });
  if(!r.ok)throw new Error(`CREATE_ORDER_${r.status}:${r.text.slice(0,400)}`);
  return Array.isArray(r.body)?r.body[0]:r.body;
}
async function completePaidOrder(orderId,payment,c){
  const paidAt=payment?.updated_at||payment?.created_at||new Date().toISOString();
  const r=await fetchJson(`${c.url}/rest/v1/rpc/complete_paid_order_and_deduct_inventory`,{
    method:'POST',
    headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},
    body:JSON.stringify({p_order_id:orderId,p_square_payment_id:payment?.id||null,p_paid_at:paidAt})
  });
  if(!r.ok)throw new Error(`COMPLETE_ORDER_${r.status}:${r.text.slice(0,400)}`);
}
async function recoverPaidCheckout(session,c){
  if(!session?.square_order_id)return null;
  const order=await squareOrder(session.square_order_id,c);
  if(!order)return null;

  // Checkout API adds a Tender after a successful buyer payment.
  // Tender.id is the corresponding Payment ID.
  const tenders=Array.isArray(order.tenders)?order.tenders:[];
  if(!tenders.length)return null;

  for(const tender of tenders){
    const paymentId=String(tender?.id||tender?.payment_id||'').trim();
    if(!paymentId)continue;
    const payment=await squarePayment(paymentId,c);
    if(String(payment?.status||'').toUpperCase()!=='COMPLETED')continue;

    const orderId=await createOrderFromCheckout(session,payment,order,c);
    if(!orderId)return null;
    await completePaidOrder(orderId,payment,c);
    return fetchOrder(orderId,c);
  }
  return null;
}

exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return{statusCode:405,headers:JSON_HEADERS,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
 const id=String(event.queryStringParameters?.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return{statusCode:400,headers:JSON_HEADERS,body:JSON.stringify({error:'INVALID_REFERENCE'})};
 try{
  const c=cfg();
  if(!c.key)return{statusCode:503,headers:JSON_HEADERS,body:JSON.stringify({error:'STATUS_UNAVAILABLE'})};

  const direct=await fetchOrder(id,c);
  if(direct)return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(direct)};

  const session=await fetchSession(id,c);
  if(!session)return{statusCode:404,headers:JSON_HEADERS,body:JSON.stringify({error:'REFERENCE_NOT_FOUND'})};

  if(session.order_id){
    const created=await fetchOrder(session.order_id,c);
    if(created)return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(created)};
  }

  // Recovery path: if webhook has not created the order yet, verify Square directly.
  const recovered=await recoverPaidCheckout(session,c);
  if(recovered){
    console.log('[order-status] recovered paid checkout',{checkoutId:session.id,orderId:recovered.id});
    return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(recovered)};
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
  console.error('order-status recovery',e);
  return{statusCode:500,headers:JSON_HEADERS,body:JSON.stringify({error:'STATUS_UNAVAILABLE'})}
 }
};
