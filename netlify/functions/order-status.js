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
function sbHeaders(c,prefer=''){
  return {apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})};
}
async function fetchOrder(orderId,c){
  const r=await fetchJson(`${c.url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,status,payment_status,total_cents,delivery_zone,created_at&limit=1`,{headers:sbHeaders(c)});
  return r.ok?r.body?.[0]||null:null;
}
async function fetchOrderBySquareId(squareOrderId,c){
  const r=await fetchJson(`${c.url}/rest/v1/orders?square_order_id=eq.${encodeURIComponent(squareOrderId)}&select=id,order_number,status,payment_status,total_cents,delivery_zone,created_at&limit=1`,{headers:sbHeaders(c)});
  return r.ok?r.body?.[0]||null:null;
}
async function fetchSession(id,c){
  const r=await fetchJson(`${c.url}/rest/v1/checkout_sessions?id=eq.${encodeURIComponent(id)}&select=id,status,payload,order_id,square_order_id,square_payment_link_id,expires_at,created_at&limit=1`,{headers:sbHeaders(c)});
  return r.ok?r.body?.[0]||null:null;
}
async function patchSession(id,values,c){
  const r=await fetchJson(`${c.url}/rest/v1/checkout_sessions?id=eq.${encodeURIComponent(id)}`,{
    method:'PATCH',headers:sbHeaders(c,'return=minimal'),body:JSON.stringify({...values,updated_at:new Date().toISOString()})
  });
  if(!r.ok)throw new Error(`SESSION_PATCH_${r.status}:${r.text.slice(0,300)}`);
}
async function squareOrder(squareOrderId,c){
  if(!squareOrderId||!c.squareToken)return null;
  const base=c.environment==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
  const r=await fetchJson(`${base}/v2/orders/${encodeURIComponent(squareOrderId)}`,{
    headers:{Authorization:`Bearer ${c.squareToken}`,'Square-Version':'2026-07-15','Content-Type':'application/json'}
  });
  if(!r.ok)throw new Error(`SQUARE_ORDER_${r.status}:${r.text.slice(0,300)}`);
  return r.body?.order||null;
}
async function squarePayment(paymentId,c){
  if(!paymentId||!c.squareToken)return null;
  const base=c.environment==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
  const r=await fetchJson(`${base}/v2/payments/${encodeURIComponent(paymentId)}`,{
    headers:{Authorization:`Bearer ${c.squareToken}`,'Square-Version':'2026-07-15','Content-Type':'application/json'}
  });
  if(!r.ok)throw new Error(`SQUARE_PAYMENT_${r.status}:${r.text.slice(0,300)}`);
  return r.body?.payment||null;
}
function amounts(order){
  return {
    taxCents:Number(order?.total_tax_money?.amount||order?.net_amounts?.tax_money?.amount||0),
    totalCents:Number(order?.total_money?.amount||order?.net_amounts?.total_money?.amount||0)
  };
}
async function createOrderDirect(session,payment,sqOrder,c){
  if(session.order_id){
    const existing=await fetchOrder(session.order_id,c);
    if(existing)return existing;
  }
  const bySquare=await fetchOrderBySquareId(session.square_order_id||payment.order_id,c);
  if(bySquare){
    await patchSession(session.id,{status:'order_created',order_id:bySquare.id},c);
    return bySquare;
  }

  const payload=session.payload||{};
  const o=payload.order||{};
  const items=Array.isArray(payload.items)?payload.items:[];
  if(!items.length)throw new Error('CHECKOUT_ITEMS_MISSING');
  const a=amounts(sqOrder);

  const orderPayload={
    status:'pending_payment',
    payment_status:'pending',
    payment_provider:'square',
    fulfillment_type:o.fulfillment_type||'delivery',
    currency:'USD',
    subtotal:Number(o.subtotal||0),
    discount_amount:0,
    tax_amount:a.taxCents/100,
    delivery_amount:Number(o.delivery_amount||0),
    total_amount:a.totalCents/100,
    subtotal_cents:Number(o.subtotal_cents||0),
    delivery_cents:Number(o.delivery_cents||0),
    tax_cents:a.taxCents,
    total_cents:a.totalCents,
    customer_name:o.customer_name||'',
    customer_email:String(o.customer_email||'').toLowerCase(),
    customer_phone:o.customer_phone||null,
    delivery_address:o.delivery_address||'',
    delivery_apt:o.delivery_apt||null,
    delivery_city:o.delivery_city||'',
    delivery_state:o.delivery_state||'',
    delivery_zip:o.delivery_zip||'',
    delivery_zone:o.delivery_zone||null,
    google_place_id:o.google_place_id||null,
    delivery_notes:o.delivery_notes||null,
    checkout_environment:o.checkout_environment||session.environment||c.environment,
    is_test:o.is_test!==false,
    square_order_id:session.square_order_id||payment.order_id,
    square_payment_link_id:session.square_payment_link_id||null
  };

  let created=await fetchJson(`${c.url}/rest/v1/orders`,{
    method:'POST',headers:sbHeaders(c,'return=representation'),body:JSON.stringify(orderPayload)
  });

  // Concurrent webhook/status recovery may have created it first.
  if(!created.ok){
    const concurrent=await fetchOrderBySquareId(orderPayload.square_order_id,c);
    if(concurrent){
      await patchSession(session.id,{status:'order_created',order_id:concurrent.id},c);
      return concurrent;
    }
    throw new Error(`ORDER_INSERT_${created.status}:${created.text.slice(0,500)}`);
  }

  const order=created.body?.[0];
  if(!order?.id)throw new Error('ORDER_INSERT_EMPTY');

  const itemPayload=items.map(i=>({
    order_id:order.id,
    product_id:i.product_id||null,
    sku:i.sku,
    product_name:i.product_name,
    variant:i.variant||null,
    variant_name:i.variant_name||i.variant||null,
    quantity:Number(i.quantity||0),
    unit_price:Number(i.unit_price||0),
    line_total:Number(i.line_total||0),
    unit_price_cents:Number(i.unit_price_cents||0),
    line_total_cents:Number(i.line_total_cents||0),
    unit_cost_snapshot:Number(i.unit_cost_snapshot||0)
  }));
  const insertedItems=await fetchJson(`${c.url}/rest/v1/order_items`,{
    method:'POST',headers:sbHeaders(c,'return=minimal'),body:JSON.stringify(itemPayload)
  });
  if(!insertedItems.ok){
    // Roll back the just-created order to avoid an incomplete operational order.
    await fetchJson(`${c.url}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`,{method:'DELETE',headers:sbHeaders(c,'return=minimal')});
    throw new Error(`ITEMS_INSERT_${insertedItems.status}:${insertedItems.text.slice(0,500)}`);
  }

  await patchSession(session.id,{status:'order_created',order_id:order.id},c);
  return order;
}
async function completePaidOrder(orderId,payment,c){
  const paidAt=payment?.updated_at||payment?.created_at||new Date().toISOString();
  const r=await fetchJson(`${c.url}/rest/v1/rpc/complete_paid_order_and_deduct_inventory`,{
    method:'POST',headers:sbHeaders(c),
    body:JSON.stringify({p_order_id:orderId,p_square_payment_id:payment?.id||null,p_paid_at:paidAt})
  });
  if(!r.ok)throw new Error(`COMPLETE_ORDER_${r.status}:${r.text.slice(0,500)}`);
}
async function recoverPaidCheckout(session,c){
  if(!session?.square_order_id)return null;
  const sqOrder=await squareOrder(session.square_order_id,c);
  const tenders=Array.isArray(sqOrder?.tenders)?sqOrder.tenders:[];
  if(!tenders.length)return null;

  for(const tender of tenders){
    // Square docs identify the associated Payment through tender.payment_id.
    const paymentId=String(tender?.payment_id||tender?.id||'').trim();
    if(!paymentId)continue;
    const payment=await squarePayment(paymentId,c);
    if(String(payment?.status||'').toUpperCase()!=='COMPLETED')continue;
    const order=await createOrderDirect(session,payment,sqOrder,c);
    await completePaidOrder(order.id,payment,c);
    return fetchOrder(order.id,c);
  }
  return null;
}

exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return{statusCode:405,headers:JSON_HEADERS,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
 const id=String(event.queryStringParameters?.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return{statusCode:400,headers:JSON_HEADERS,body:JSON.stringify({error:'INVALID_REFERENCE'})};
 try{
  const c=cfg();
  if(!c.key||!c.squareToken)return{statusCode:503,headers:JSON_HEADERS,body:JSON.stringify({error:'STATUS_CONFIGURATION_MISSING'})};

  const direct=await fetchOrder(id,c);
  if(direct)return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(direct)};

  const session=await fetchSession(id,c);
  if(!session)return{statusCode:404,headers:JSON_HEADERS,body:JSON.stringify({error:'REFERENCE_NOT_FOUND'})};

  if(session.order_id){
    const created=await fetchOrder(session.order_id,c);
    if(created)return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(created)};
  }

  const recovered=await recoverPaidCheckout(session,c);
  if(recovered){
    console.log('[order-status] paid checkout recovered',{checkoutId:session.id,orderId:recovered.id});
    return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify(recovered)};
  }

  const failed=['failed','expired'].includes(String(session.status||'').toLowerCase());
  return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify({
    checkout_id:session.id,status:failed?'payment_failed':'processing',
    payment_status:failed?'failed':'processing',order_created:false,created_at:session.created_at
  })};
 }catch(e){
  console.error('[order-status] recovery failed',e);
  return{statusCode:500,headers:JSON_HEADERS,body:JSON.stringify({
    error:'ORDER_RECOVERY_FAILED',
    stage:String(e.message||'UNKNOWN').split(':')[0]
  })}
 }
};
