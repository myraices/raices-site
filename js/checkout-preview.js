(function(){
 const lang=(localStorage.getItem('raices_lang')||'es').toLowerCase().startsWith('en')?'en':'es';
 const tr=(es,en)=>lang==='en'?en:es;
 document.documentElement.lang=lang;
 const money=n=>`$${Number(n||0).toFixed(2)}`, zipNorm=v=>String(v||'').replace(/\D/g,'').slice(0,5);
 let summary={};try{summary=JSON.parse(localStorage.getItem('raices_cart_summary')||'{}')}catch(e){}
 const items=summary.items||[], cfg=window.RAICES_STORE_CONFIG||{}, rules=cfg.ORDER_RULES||{};
 let zones=[], deliveryConfigReady=false, fulfillmentOptionsReady=false, localDeliveryEligible=true, shippingEligible=false, shippingEnabled=false, shippingAllowedStates=[], shippingRateMode="shippo", shippingSetupProblems=[];
 let shippingRates=[],shippingShipmentId='',selectedShippingRateId='',shippingRatesLoading=false,shippingRateError='',lastShippingQuoteKey='';
 let freeShippingEnabled=false,freeShippingActive=false,freeShippingThreshold=0;
 let selectedFulfillment=localStorage.getItem('raices_fulfillment_method')||'delivery';
 let freeDeliveryEnabled=true, freeDeliveryActive=true, freeDeliveryThreshold=Number(rules.freeDeliveryThreshold??100), freeDeliveryStartDate="", freeDeliveryEndDate="";
 const isDigitalItem=i=>{const sku=String(i?.sku||'').toUpperCase();const name=String(i?.name||'');return sku.startsWith('RA-LB-')||/volver a lo esencial|21 días|21 dias|cocina desde la raíz|cocina desde la raiz|rituales/i.test(name);};
 const hasPhysicalItems=items.some(i=>!isDigitalItem(i));
 const digitalOnly=items.length>0&&!hasPhysicalItems;
 const itemsEl=document.getElementById('previewItems');
 itemsEl.innerHTML=items.length?items.map(i=>`<div class="preview-item"><span>${i.qty} × ${i.name||i.sku}${i.variant?` · ${i.variant}`:''}</span><strong>${money(i.lineTotal||((i.qty||0)*Number(i.price||0)))}</strong></div>`).join(''):'<div class="preview-empty">Tu carrito está vacío. Regresa a la tienda para agregar productos.</div>';
 const fields={name:'checkoutName',email:'checkoutEmail',phone:'checkoutPhone',address:'checkoutAddress',apt:'checkoutApt',city:'checkoutCity',state:'checkoutState',zip:'checkoutZip',notes:'checkoutNotes',placeId:'checkoutPlaceId',latitude:'checkoutLatitude',longitude:'checkoutLongitude',digitalState:'checkoutDigitalState',digitalZip:'checkoutDigitalZip'};
 let saved={};try{saved=JSON.parse(localStorage.getItem('raices_checkout_customer')||'{}')}catch(e){}
 let addressVerified=Boolean(saved.placeId&&saved.address&&saved.city&&saved.state&&saved.zip);
 Object.entries(fields).forEach(([k,id])=>{const e=document.getElementById(id);if(e)e.value=saved[k]||((k==='state'||k==='digitalState')?'TX':'')});
 const list=value=>Array.isArray(value)?value.flatMap(list):String(value||'').split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean);
 const normalizeZones=input=>(Array.isArray(input)?input:[]).map(zone=>{const coverage=[...list(zone?.zips ?? zone?.zip_codes ?? zone?.zipCodes),...list(zone?.coverage)];const zips=coverage.filter(v=>!String(v).endsWith('*')).map(zipNorm).filter(v=>v.length===5);const prefixes=[...coverage.filter(v=>String(v).endsWith('*')).map(v=>String(v).replace(/\D/g,'').slice(0,5)),...list(zone?.prefixes ?? zone?.prefix).map(v=>String(v).replace(/\D/g,'').slice(0,5))].filter(Boolean);return{name:String(zone?.name||zone?.label||'').trim(),fee:Number(zone?.fee ?? zone?.cost ?? zone?.price ?? 0),zips:[...new Set(zips)],prefixes:[...new Set(prefixes)]}}).filter(zone=>zone.name&&(zone.zips.length||zone.prefixes.length));
 const zoneFor=z=>zones.find(x=>(x.zips||[]).includes(z)||(x.prefixes||[]).some(p=>z.startsWith(p)));
 const componentValue=(components,type,shortName=false)=>{const item=(components||[]).find(c=>(c.types||[]).includes(type));if(!item)return'';return shortName?(item.shortText||item.short_name||''):(item.longText||item.long_name||item.shortText||'')};
 async function loadDeliveryConfig(){
  if(digitalOnly){deliveryConfigReady=true;return;}
  try{const res=await fetch('/.netlify/functions/delivery-config',{cache:'no-store'});const body=await res.json().catch(()=>({}));if(!res.ok||!Array.isArray(body.zones))throw new Error(body.error||'DELIVERY_CONFIG_UNAVAILABLE');zones=normalizeZones(body.zones);freeDeliveryEnabled=body.freeDeliveryEnabled!==false;freeDeliveryActive=body.freeDeliveryActive!==false;freeDeliveryStartDate=String(body.freeDeliveryStartDate||"");freeDeliveryEndDate=String(body.freeDeliveryEndDate||"");const remoteThreshold=Number(body.freeDeliveryThreshold);if(Number.isFinite(remoteThreshold)&&remoteThreshold>=0)freeDeliveryThreshold=remoteThreshold;deliveryConfigReady=true;}catch(err){console.error('Raíces checkout delivery configuration error',err);zones=[];deliveryConfigReady=false;}
 }
 async function loadFulfillmentOptions(){
  if(digitalOnly){fulfillmentOptionsReady=true;selectedFulfillment='digital';return;}
  try{
   const res=await fetch('/.netlify/functions/fulfillment-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items.map(i=>({sku:i.sku,qty:i.qty}))})});
   const body=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(body.error||'FULFILLMENT_OPTIONS_UNAVAILABLE');
   localDeliveryEligible=body.localDeliveryEligible===true;
   shippingEnabled=body.shippingEnabled===true;
   shippingEligible=body.shippingEligible===true;
   shippingAllowedStates=Array.isArray(body.allowedStates)?body.allowedStates.map(v=>String(v).toUpperCase()):[];
   shippingRateMode=String(body.shippingRateMode||'shippo');
   shippingSetupProblems=Array.isArray(body.shippingSetupProblems)?body.shippingSetupProblems:[];
   freeShippingEnabled=body.freeShipping?.enabled===true;
   freeShippingActive=body.freeShipping?.active===true;
   freeShippingThreshold=Number(body.freeShipping?.threshold||0);
   if(selectedFulfillment==='shipping'&&!shippingEligible)selectedFulfillment=localDeliveryEligible?'delivery':'shipping';
   if(selectedFulfillment==='delivery'&&!localDeliveryEligible&&shippingEligible)selectedFulfillment='shipping';
   fulfillmentOptionsReady=true;
  }catch(err){
   console.error('Raíces fulfillment options error',err);
   fulfillmentOptionsReady=false;shippingEligible=false;
  }
 }
 function shippingQuoteKey(data){
  return JSON.stringify({
   address:data.address||'',apt:data.apt||'',city:data.city||'',state:data.state||'',zip:zipNorm(data.zip),
   items:items.map(i=>[i.sku,Number(i.qty||1),i.variant||''])
  });
 }
 function curatedShippingRates(){
  if(!shippingRates.length)return [];
  const sorted=[...shippingRates].sort((a,b)=>Number(a.amount||0)-Number(b.amount||0));
  const chosen=[];
  const push=(rate,labelKey)=>{if(rate&&!chosen.some(x=>String(x.rate.id)===String(rate.id)))chosen.push({rate,labelKey})};

  // Economy: cheapest available rate.
  push(sorted[0],'economy');

  // Standard: prefer a true Ground / standard service, excluding saver/economy-style products.
  const standard=sorted.find(r=>{
    const s=`${r.provider||''} ${r.service||''}`.toLowerCase();
    return !chosen.some(x=>String(x.rate.id)===String(r.id))
      && /(ground|priority mail|home delivery|standard)/i.test(s)
      && !/(saver|advantage|economy|select|express|air|next day|overnight)/i.test(s);
  }) || sorted.find(r=>!chosen.some(x=>String(x.rate.id)===String(r.id)) && Number(r.estimatedDays||99)<=3);
  push(standard,'standard');

  // Express: cheapest one-day service. If unavailable, choose the fastest remaining rate.
  let express=sorted.find(r=>!chosen.some(x=>String(x.rate.id)===String(r.id)) && Number(r.estimatedDays||99)<=1);
  if(!express){
    const remaining=sorted.filter(r=>!chosen.some(x=>String(x.rate.id)===String(r.id)));
    remaining.sort((a,b)=>{
      const da=Number.isFinite(Number(a.estimatedDays))?Number(a.estimatedDays):99;
      const db=Number.isFinite(Number(b.estimatedDays))?Number(b.estimatedDays):99;
      return da-db || Number(a.amount||0)-Number(b.amount||0);
    });
    express=remaining[0]||null;
  }
  push(express,'express');

  // If any category could not be filled, complete up to three with cheapest remaining options.
  for(const r of sorted){
    if(chosen.length>=3)break;
    push(r,chosen.length===1?'standard':'express');
  }
  return chosen.slice(0,3);
 }
 function rateCategoryLabel(key){
  return key==='economy'?tr('Económico','Economy'):key==='standard'?tr('Estándar','Standard'):tr('Express','Express');
 }
 function selectedShippingRate(){return shippingRates.find(r=>String(r.id)===String(selectedShippingRateId))||null}
 function shippingErrorText(code){
  const messages={
   SHIPPING_ORIGIN_INCOMPLETE:tr('Completa la dirección de origen en NURAI → Configuración → Logística.','Complete the shipping origin address in NURAI → Settings → Logistics.'),
   SHIPPING_PACKAGE_PROFILE_MISSING:tr('Falta un perfil de empaque válido para uno de los productos.','A valid packaging profile is missing for one of the products.'),
   SHIPPING_PRODUCT_WEIGHT_MISSING:tr('Falta el peso de Shipping en uno de los productos.','A shipping weight is missing for one of the products.'),
   SHIPPING_PACKAGE_DIMENSIONS_MISSING:tr('Faltan dimensiones en el perfil de empaque.','The packaging profile is missing dimensions.'),
   SHIPPO_TOKEN_MISSING:tr('La conexión con Shippo todavía no está disponible.','The Shippo connection is not available yet.'),
   SHIPPO_RATE_REQUEST_FAILED:tr('Shippo no pudo obtener tarifas para esta dirección. Revisa los datos e intenta nuevamente.','Shippo could not retrieve rates for this address. Check the details and try again.'),
   SHIPPO_NETWORK_FAILED:tr('No pudimos conectar con Shippo. Intenta nuevamente; si continúa, revisaremos el diagnóstico de conexión.','We could not connect to Shippo. Try again; if it continues, we will review the connection diagnostic.'),
   NO_SHIPPING_RATES:tr('No encontramos opciones de Shipping para esta dirección.','No shipping options were found for this address.'),
   SHIPPING_RATES_UNAVAILABLE:tr('No pudimos calcular Shipping en este momento.','Shipping could not be calculated right now.')
  };
  return messages[code]||messages.SHIPPING_RATES_UNAVAILABLE;
 }
 async function loadShippingRates(force=false){
  if(digitalOnly||selectedFulfillment!=='shipping'||!shippingEligible||!addressVerified)return;
  const data=save();
  if(!shippingStateAllowed(data.state))return;
  const key=shippingQuoteKey(data);
  if(!force&&key===lastShippingQuoteKey&&(shippingRates.length||shippingRatesLoading))return;
  lastShippingQuoteKey=key;shippingRatesLoading=true;shippingRateError='';shippingRates=[];shippingShipmentId='';selectedShippingRateId='';
  render();
  try{
   const res=await fetch('/.netlify/functions/shipping-rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    items:items.map(i=>({sku:i.sku,qty:i.qty,variant:i.variant||''})),
    customer:{...data,zip:zipNorm(data.zip)}
   })});
   const body=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(body.error||'SHIPPING_RATES_UNAVAILABLE');
   shippingRates=Array.isArray(body.rates)?body.rates:[];
   shippingShipmentId=String(body.shipmentId||'');
   if(shippingRates.length)selectedShippingRateId=String(shippingRates[0].id||'');
   if(!shippingRates.length)shippingRateError='NO_SHIPPING_RATES';
  }catch(err){
   console.error('Shipping rates error',err);
   shippingRateError=String(err.message||'SHIPPING_RATES_UNAVAILABLE');
  }finally{
   shippingRatesLoading=false;render();
  }
 }
 function loadGoogleMaps(){
  if(window.google?.maps?.importLibrary)return Promise.resolve();
  const key=window.RAICES_GOOGLE_MAPS_API_KEY;
  if(!key||key.includes('__GOOGLE_')||key.includes('PASTE_YOUR_'))return Promise.reject(new Error('MAPS_KEY_MISSING'));
  ((g)=>{var h,a,k,p='The Google Maps JavaScript API',c='google',l='importLibrary',q='__ib__',m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await(a=m.createElement('script'));e.set('libraries',[...r]+'');for(k in g)e.set(k.replace(/[A-Z]/g,t=>'_'+t[0].toLowerCase()),g[k]);e.set('callback',c+'.maps.'+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+' could not load.'));a.nonce=m.querySelector('script[nonce]')?.nonce||'';m.head.append(a)}));d[l]?console.warn(p+' only loads once. Ignoring:',g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key,v:'weekly',language:'es',region:'US'});
  return Promise.resolve();
 }
 function save(){const d={};Object.entries(fields).forEach(([k,id])=>d[k]=document.getElementById(id)?.value.trim()||'');d.addressVerified=addressVerified;localStorage.setItem('raices_checkout_customer',JSON.stringify(d));return d}
 function eta(){const d=new Date();d.setHours(d.getHours()+Number(rules.estimatedDeliveryMinHours||24));const e=new Date();e.setHours(e.getHours()+Number(rules.estimatedDeliveryMaxHours||48));const f=x=>x.toLocaleDateString('es-US',{weekday:'short',month:'short',day:'numeric'});return `${f(d)} – ${f(e)}`}
 function shippingStateAllowed(state){return shippingAllowedStates.includes(String(state||'').trim().toUpperCase())}
 function render(){
  const data=save(),zip=zipNorm(data.zip),zone=digitalOnly?{name:'Entrega digital',fee:0}:(addressVerified&&zip.length===5?zoneFor(zip):null),subtotal=Number(summary.subtotal||0);
  const physicalSubtotal=items.filter(i=>!isDigitalItem(i)).reduce((sum,i)=>sum+Number(i.lineTotal||((i.qty||0)*Number(i.price||0))),0);
  const freeAt=freeDeliveryActive?Number(freeDeliveryThreshold||0):-1;
  const qualifies=hasPhysicalItems&&freeDeliveryActive&&(freeAt===0||physicalSubtotal>=freeAt);
  const localAvailable=hasPhysicalItems&&localDeliveryEligible&&!!zone&&addressVerified;
  const shippingDestinationOk=hasPhysicalItems&&shippingEligible&&addressVerified&&shippingStateAllowed(data.state);
  if(!digitalOnly&&addressVerified){
   if(selectedFulfillment==='delivery'&&!localAvailable&&shippingDestinationOk)selectedFulfillment='shipping';
   else if(selectedFulfillment==='shipping'&&!shippingDestinationOk&&localAvailable)selectedFulfillment='delivery';
  }
  if(!digitalOnly)localStorage.setItem('raices_fulfillment_method',selectedFulfillment);
  const isShipping=!digitalOnly&&selectedFulfillment==='shipping';
  const currentQuoteKey=shippingQuoteKey(data);
  if(isShipping&&addressVerified&&lastShippingQuoteKey&&currentQuoteKey!==lastShippingQuoteKey){
   shippingRates=[];shippingShipmentId='';selectedShippingRateId='';shippingRateError='';lastShippingQuoteKey='';
  }
  const rate=selectedShippingRate();
  const shippingFree=Boolean(isShipping&&rate&&freeShippingActive&&(freeShippingThreshold===0||physicalSubtotal>=freeShippingThreshold));
  const delivery=digitalOnly?0:(isShipping?(shippingFree?0:Number(rate?.amount||0)):(zone&&items.length?(qualifies?0:Number(zone.fee||0)):0));

  const methodBlock=document.getElementById('checkoutFulfillmentBlock');
  const localRow=document.getElementById('fulfillmentLocalRow');
  const shippingRow=document.getElementById('fulfillmentShippingRow');
  const localRadio=document.getElementById('fulfillmentLocal');
  const shippingRadio=document.getElementById('fulfillmentShipping');
  const methodStatus=document.getElementById('checkoutFulfillmentStatus');
  if(methodBlock){methodBlock.hidden=digitalOnly;methodBlock.style.display=digitalOnly?'none':'';}
  const outsideLocalArea=Boolean(addressVerified&&zip.length===5&&localDeliveryEligible&&!zone);
  if(localRow)localRow.hidden=!localDeliveryEligible;
  if(shippingRow)shippingRow.hidden=!shippingEligible;
  if(localRadio){localRadio.checked=selectedFulfillment==='delivery';localRadio.disabled=!localDeliveryEligible||outsideLocalArea;}
  if(shippingRadio){shippingRadio.checked=selectedFulfillment==='shipping';shippingRadio.disabled=!shippingEligible;}
  if(methodStatus&&!digitalOnly){
   const noMethod=fulfillmentOptionsReady&&!localDeliveryEligible&&!shippingEligible;
   const setupBlocked=shippingEnabled&&!shippingEligible&&shippingSetupProblems.length>0&&localDeliveryEligible;
   methodStatus.hidden=!(outsideLocalArea||noMethod||setupBlocked);
   methodStatus.textContent=outsideLocalArea
    ?(shippingEligible
      ?tr('Esta dirección está fuera de nuestra zona de Delivery local. Puedes continuar con Shipping.','This address is outside our Local Delivery area. You can continue with Shipping.')
      :tr('Esta dirección está fuera de nuestra zona de Delivery local.','This address is outside our Local Delivery area.'))
    :noMethod
      ?tr('No hay un método de entrega disponible para este carrito.','No delivery method is available for this cart.')
      :tr('Shipping no está disponible para este carrito todavía.','Shipping is not available for this cart yet.');
  }

  const ratesBox=document.getElementById('checkoutShippingRates');
  const ratesStatus=document.getElementById('checkoutShippingRatesStatus');
  const ratesList=document.getElementById('checkoutShippingRatesList');
  if(ratesBox)ratesBox.hidden=!isShipping;
  if(ratesStatus)ratesStatus.textContent=shippingRatesLoading?tr('Calculando…','Calculating…'):(shippingRateError?shippingErrorText(shippingRateError):'');
  if(ratesList){
   if(!isShipping||shippingRatesLoading)ratesList.innerHTML='';
   else if(shippingRateError)ratesList.innerHTML=`<button type="button" class="checkout-shipping-retry">${tr('Intentar de nuevo','Try again')}</button>`;
   else {
    const curated=curatedShippingRates();
    // If the previously selected rate is hidden by a fresh quote, use the first curated option.
    if(curated.length&&!curated.some(x=>String(x.rate.id)===String(selectedShippingRateId))){
      selectedShippingRateId=String(curated[0].rate.id||'');
    }
    ratesList.innerHTML=curated.map(({rate:r,labelKey})=>{
      const checked=String(r.id)===String(selectedShippingRateId)?' checked':'';
      const days=r.estimatedDays?tr(`${r.estimatedDays} día${r.estimatedDays===1?'':'s'} estimado${r.estimatedDays===1?'':'s'}`,`${r.estimatedDays} estimated day${r.estimatedDays===1?'':'s'}`):(r.durationTerms||'');
      return `<label class="checkout-shipping-rate"><input type="radio" name="shippingRate" value="${String(r.id).replace(/"/g,'&quot;')}"${checked}><span><em class="checkout-shipping-rate__category">${rateCategoryLabel(labelKey)}</em><strong>${r.provider||''} · ${r.service||'Shipping'}</strong>${days?`<small>${days}</small>`:''}</span><b>${money(r.amount)}</b></label>`;
    }).join('');
   }
  }

  previewSubtotal.textContent=money(subtotal);
  const feeLabel=document.getElementById('previewFulfillmentLabel');if(feeLabel)feeLabel.textContent=digitalOnly?tr('Entrega','Delivery'):(isShipping?'Shipping':tr('Delivery','Local Delivery'));
  previewDelivery.textContent=digitalOnly?tr('No aplica','N/A'):(isShipping?(rate?(shippingFree?tr('Gratis','Free'):money(delivery)):(shippingRatesLoading?tr('Calculando…','Calculating…'):'—')):(zone?(qualifies?tr('Gratis','Free'):money(delivery)):'—'));
  previewTotal.textContent=money(subtotal+delivery);
  checkoutEta.textContent=digitalOnly?tr('Acceso digital después de confirmar el pago.','Digital access after payment is confirmed.'):isShipping?(rate?(rate.estimatedDays?tr(`Aproximadamente ${rate.estimatedDays} día${rate.estimatedDays===1?'':'s'} hábil${rate.estimatedDays===1?'':'es'}.`,`Approximately ${rate.estimatedDays} business day${rate.estimatedDays===1?'':'s'}.`):(rate.durationTerms||tr('Según el servicio seleccionado.','Based on the selected service.'))):tr('Selecciona una opción de Shipping.','Select a Shipping option.')):(items.length?`${eta()} · ${tr('normalmente dentro de 24–48 horas.','normally within 24–48 hours.')}`:tr('Agrega productos para calcular la entrega.','Add products to calculate delivery.'));
  const left=Math.max(0,freeAt-physicalSubtotal);
  freeDeliveryProgress.textContent=digitalOnly?tr('Los productos digitales no tienen cargo de delivery.','Digital products have no delivery charge.'):isShipping?(shippingFree?tr('Has desbloqueado Shipping gratis.','You unlocked free Shipping.'):(freeShippingActive&&freeShippingThreshold>0?`${tr('Agrega','Add')} ${money(Math.max(0,freeShippingThreshold-physicalSubtotal))} ${tr('más para Shipping gratis.','more for free Shipping.')}`:'')):(!freeDeliveryEnabled?'':!freeDeliveryActive?(freeDeliveryStartDate?`${tr('Delivery gratis disponible desde','Free delivery available from')} ${freeDeliveryStartDate}.`:''):freeAt===0?tr('Delivery gratis en todas las compras físicas.','Free delivery on all physical purchases.'):qualifies?tr('Has desbloqueado delivery gratis.','You unlocked free delivery.'):`${tr('Agrega','Add')} ${money(left)} ${tr('más en productos físicos para delivery gratis.','more in physical products for free delivery.')}`);

  const status=document.getElementById('checkoutGoogleAddressStatus');if(status){status.dataset.state=addressVerified?'ok':'idle';status.textContent=addressVerified?tr('Dirección verificada por Google.','Address verified by Google.'):tr('Selecciona una dirección completa de las sugerencias de Google.','Select a complete address from Google suggestions.')}
  const msg=checkoutDeliveryMessage;
  if(!items.length){msg.dataset.state='error';msg.textContent=tr('Tu carrito está vacío.','Your cart is empty.')}
  else if(digitalOnly){msg.dataset.state='ok';msg.textContent=tr('Producto digital: no requiere dirección ni delivery.','Digital product: no shipping address is required.')}
  else if(!deliveryConfigReady||!fulfillmentOptionsReady){msg.dataset.state='idle';msg.textContent=tr('Cargando opciones de entrega…','Loading delivery options…')}
  else if(!addressVerified){msg.dataset.state='idle';msg.textContent=tr('Selecciona primero una dirección válida de Google para confirmar las opciones disponibles.','Select a valid Google address first to confirm the available options.')}
  else if(isShipping&&!shippingDestinationOk){msg.dataset.state='error';msg.textContent=tr('Shipping no está habilitado para este destino.','Shipping is not available for this destination.')}
  else if(isShipping&&shippingRateError){msg.dataset.state='error';msg.textContent=shippingErrorText(shippingRateError)}
  else if(isShipping){msg.dataset.state='ok';msg.textContent=shippingRatesLoading?tr('Calculando opciones de Shipping…','Calculating Shipping options…'):tr('Selecciona el servicio que prefieras.','Select your preferred service.');}
  else if(!zone){msg.dataset.state='error';msg.textContent=shippingEligible?tr('Esta dirección está fuera del Delivery local. Selecciona Shipping para continuar.','This address is outside Local Delivery. Select Shipping to continue.'):`${tr('La dirección seleccionada está fuera de la cobertura configurada.','The selected address is outside the configured delivery area.')}`}
  else{msg.dataset.state='ok';msg.textContent=qualifies?tr('Delivery local disponible · Gratis.','Local Delivery available · Free.'):tr('Delivery local disponible.','Local Delivery available.')}

  const payButton=document.getElementById('previewPayButton');
  if(payButton){
   const shippingReady=!isShipping||(Boolean(rate)&&!shippingRatesLoading&&!shippingRateError);
   payButton.disabled=!items.length||!shippingReady;
   payButton.textContent=tr('CONTINUAR AL PAGO','CONTINUE TO PAYMENT');
  }
  summary={...summary,fulfillmentType:digitalOnly?'digital':selectedFulfillment,delivery:{zip:digitalOnly?'00000':zip,valid:digitalOnly||(isShipping?shippingDestinationOk&&Boolean(rate):!!zone&&addressVerified),zone:isShipping?(rate?`${rate.provider} · ${rate.service}`:'Shipping'):(zone?.name||''),cost:delivery,digitalOnly},deliveryCost:delivery,total:subtotal+delivery,customer:data,addressVerified,estimatedDelivery:isShipping?(rate?.durationTerms||'Shipping'):eta(),shippingRate:rate||null,shippingShipmentId};
  localStorage.setItem('raices_cart_summary',JSON.stringify(summary));

  if(isShipping&&shippingDestinationOk&&!shippingRatesLoading&&!shippingRateError&&!shippingRates.length){
   queueMicrotask(()=>loadShippingRates(false));
  }
 }
 function applyCheckoutLanguage(){
  const set=(selector,es,en)=>{const el=document.querySelector(selector);if(el)el.textContent=tr(es,en)};
  set('.checkout-preview-header span','Checkout seguro','Secure checkout');
  set('#checkoutProgressDelivery','1 · Entrega','1 · Delivery');
  const progress=document.querySelectorAll('.checkout-progress span');if(progress[1])progress[1].textContent=tr('2 · Revisión','2 · Review');if(progress[2])progress[2].textContent=tr('3 · Pago','3 · Payment');
  set('.checkout-preview-intro .eyebrow','Compra segura','Secure purchase');
  set('.checkout-preview-intro h1','Completa tu pedido.','Complete your order.');
  const intro=document.querySelector('.checkout-preview-intro p:last-child');if(intro)intro.textContent=tr('Revisa tus datos antes de continuar al pago seguro.','Review your details before continuing to secure payment.');
  set('.checkout-form-card h2','Contacto y entrega','Contact and delivery');
  set('#checkoutAccountAddress strong','Dirección guardada','Saved address');
  set('#useSavedAddressBtn','Usar esta dirección','Use this address');
  const labels=[...document.querySelectorAll('.checkout-fields label>span')];
  const pairs=[['Nombre y apellido','Full name'],['Email','Email'],['Estado de facturación','Billing state'],['ZIP de facturación','Billing ZIP'],['Teléfono','Phone'],['Dirección','Address'],['Apt / Suite','Apt / Suite'],['Ciudad','City'],['Estado','State'],['ZIP Code','ZIP Code'],['Instrucciones de entrega','Delivery instructions']];
  labels.forEach((el,i)=>{if(pairs[i])el.textContent=tr(pairs[i][0],pairs[i][1])});
  const notes=document.getElementById('checkoutNotes');if(notes)notes.placeholder=tr('Gate code, dejar en la puerta, etc.','Gate code, leave at the door, etc.');
  set('#checkoutFulfillmentBlock h3','Método de entrega','Delivery method');
  set('#fulfillmentLocalRow strong','Delivery local','Local Delivery');
  set('#checkoutShippingLabel','Shipping','Shipping');
  set('#checkoutShippingRatesTitle','Opciones de Shipping','Shipping options');
  set('.checkout-promise strong','Entrega estimada','Estimated delivery');
  const terms=document.querySelector('.checkout-terms span');if(terms)terms.innerHTML=lang==='en'
    ? 'I accept the <a href="terms.html" target="_blank">Terms</a>, the <a href="delivery-policy.html" target="_blank">Delivery Policy</a> and the <a href="refund-policy.html" target="_blank">Cancellation, Returns and Refund Policy</a>.'
    : 'Acepto los <a href="terms.html" target="_blank">Términos</a>, la <a href="delivery-policy.html" target="_blank">Política de entrega</a> y la <a href="refund-policy.html" target="_blank">Política de cancelaciones, devoluciones y reembolsos</a>.';
  set('.checkout-edit-link','← Editar carrito','← Edit cart');
  set('.checkout-summary-card h2','Resumen del pedido','Order summary');
  const totalLabels=document.querySelectorAll('.preview-totals>div>span');
  if(totalLabels[0])totalLabels[0].textContent=tr('Subtotal','Subtotal');
  const taxRow=[...document.querySelectorAll('.preview-totals>div')].find(row=>row.textContent.includes('Impuestos')||row.textContent.includes('Taxes'));
  if(taxRow){const s=taxRow.querySelector('span'),strong=taxRow.querySelector('strong');if(s)s.textContent=tr('Impuestos','Taxes');if(strong)strong.textContent=tr('Calculados al pagar','Calculated at payment');}
  const totalRow=document.querySelector('.preview-total span');if(totalRow)totalRow.textContent=tr('Total estimado','Estimated total');
  set('#checkoutSecureRedirectText',tr('Serás dirigido a una página de pago segura para completar tu compra.','You will be redirected to a secure payment page to complete your purchase.'),'You will be redirected to a secure payment page to complete your purchase.');
  set('#previewPayButton',tr('CONTINUAR AL PAGO','CONTINUE TO PAYMENT'),'CONTINUE TO PAYMENT');
  set('.checkout-back','← Volver a la tienda','← Back to the store');
 }
 function applyDigitalCheckoutMode(){
  document.querySelectorAll('[data-digital-tax-field]').forEach(el=>{el.hidden=!digitalOnly;el.style.display=digitalOnly?'':'';el.setAttribute('aria-hidden',digitalOnly?'false':'true');});
  document.querySelectorAll('[data-delivery-field]').forEach(el=>{el.hidden=digitalOnly;el.style.display=digitalOnly?'none':'';el.setAttribute('aria-hidden',digitalOnly?'true':'false');});
  const deliveryBlock=document.getElementById('checkoutDeliveryBlock');if(deliveryBlock){deliveryBlock.hidden=digitalOnly;deliveryBlock.style.display=digitalOnly?'none':'';deliveryBlock.setAttribute('aria-hidden',digitalOnly?'true':'false');}
  const phone=document.getElementById('checkoutPhone');if(phone){phone.required=!digitalOnly;if(digitalOnly)phone.value='';}
  if(digitalOnly){['checkoutAddress','checkoutApt','checkoutCity','checkoutState','checkoutZip','checkoutNotes','checkoutPlaceId','checkoutLatitude','checkoutLongitude'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});addressVerified=false;}
  const heading=document.querySelector('.checkout-form-card h2');if(heading)heading.textContent=digitalOnly?'Información de contacto':'Contacto y entrega';
  const intro=document.querySelector('.checkout-preview-intro p:last-child');if(intro)intro.textContent=digitalOnly?'Necesitamos tu nombre, correo, estado y ZIP de facturación para calcular correctamente el sales tax.':'Revisa tus datos antes de continuar al pago.';
  const progress=document.getElementById('checkoutProgressDelivery');if(progress)progress.textContent=digitalOnly?'1 · Contacto':'1 · Entrega';
 }
 async function initAddressAutocomplete(){
  const host=document.getElementById('checkoutGoogleAddressHost');if(!host)return;
  try{
   await loadGoogleMaps();const {PlaceAutocompleteElement}=await google.maps.importLibrary('places');if(!PlaceAutocompleteElement)throw new Error('PLACES_AUTOCOMPLETE_UNAVAILABLE');
   host.innerHTML='';const autocompleteElement=new PlaceAutocompleteElement({includedRegionCodes:['us']});autocompleteElement.placeholder='Empieza a escribir tu dirección';autocompleteElement.classList.add('raices-place-autocomplete');host.appendChild(autocompleteElement);if(addressVerified&&saved.address)autocompleteElement.value=saved.address;
   const invalidate=()=>{addressVerified=false;['checkoutAddress','checkoutPlaceId','checkoutLatitude','checkoutLongitude','checkoutCity','checkoutZip'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});document.getElementById('checkoutState').value='TX';render()};
   autocompleteElement.addEventListener('input',invalidate);autocompleteElement.addEventListener('change',invalidate);
   autocompleteElement.addEventListener('gmp-select',async event=>{
    try{const prediction=event.placePrediction;if(!prediction)throw new Error('PLACE_PREDICTION_MISSING');const place=prediction.toPlace();await place.fetchFields({fields:['id','formattedAddress','location','addressComponents']});const c=place.addressComponents||[],street=[componentValue(c,'street_number'),componentValue(c,'route')].filter(Boolean).join(' '),city=componentValue(c,'locality')||componentValue(c,'postal_town')||componentValue(c,'sublocality'),state=componentValue(c,'administrative_area_level_1',true),zip=componentValue(c,'postal_code'),country=componentValue(c,'country',true);if(!street||!city||!state||!zip||country!=='US')throw new Error('INCOMPLETE_US_ADDRESS');document.getElementById('checkoutAddress').value=street;document.getElementById('checkoutCity').value=city;document.getElementById('checkoutState').value=state;document.getElementById('checkoutZip').value=zipNorm(zip);document.getElementById('checkoutPlaceId').value=place.id||'';document.getElementById('checkoutLatitude').value=place.location?.lat?.()??'';document.getElementById('checkoutLongitude').value=place.location?.lng?.()??'';autocompleteElement.value=place.formattedAddress||`${street}, ${city}, ${state} ${zip}`;addressVerified=true;render();setTimeout(()=>document.getElementById('checkoutApt')?.focus(),150)}catch(err){console.error('Raíces checkout address selection error',err);addressVerified=false;render();const status=document.getElementById('checkoutGoogleAddressStatus');if(status){status.dataset.state='error';status.textContent='Selecciona una dirección residencial completa en Estados Unidos.'}}
   });
  }catch(err){console.error('Raíces Google Maps initialization error',err);addressVerified=false;render();const status=document.getElementById('checkoutGoogleAddressStatus');if(status){status.dataset.state='error';status.textContent=err.message==='MAPS_KEY_MISSING'?'No se configuró la clave de Google Maps.':'No se pudo cargar la búsqueda de direcciones de Google.'}}
 }

 async function loadDefaultAddress(){
  if(!window.raicesSupabase||digitalOnly)return;
  try{
   const {data}=await window.raicesSupabase.auth.getUser(); const user=data?.user;if(!user)return;
   const {data:addresses,error}=await window.raicesSupabase.from('customer_addresses').select('*').eq('user_id',user.id).order('is_default',{ascending:false}).order('created_at',{ascending:true}).limit(1);
   if(error||!addresses?.length)return; const a=addresses[0];
   const address1=a.address_line1||a.address1||'';
   const address2=a.address_line2||a.address2||'';
   const postalCode=zipNorm(a.postal_code||a.zip||'');
   const placeId=a.place_id||a.google_place_id||'';
   const box=document.getElementById('checkoutAccountAddress'),text=document.getElementById('checkoutSavedAddressText'),btn=document.getElementById('useSavedAddressBtn');
   if(!box||!text||!btn)return; text.textContent=[address1,address2,a.city,a.state,postalCode].filter(Boolean).join(', '); box.hidden=false;
   btn.onclick=()=>{
    document.getElementById('checkoutAddress').value=address1;document.getElementById('checkoutApt').value=address2;document.getElementById('checkoutCity').value=a.city||'';document.getElementById('checkoutState').value=a.state||'TX';document.getElementById('checkoutZip').value=postalCode;document.getElementById('checkoutNotes').value=a.delivery_notes||'';document.getElementById('checkoutPlaceId').value=placeId;document.getElementById('checkoutLatitude').value=a.latitude||'';document.getElementById('checkoutLongitude').value=a.longitude||'';addressVerified=Boolean(placeId&&address1&&a.city&&postalCode);const host=document.querySelector('#checkoutGoogleAddressHost gmp-place-autocomplete');if(host)host.value=[address1,a.city,a.state,postalCode].filter(Boolean).join(', ');render();box.classList.add('used');btn.textContent='Dirección aplicada';
   };
  }catch(err){console.warn('No se pudo cargar la dirección predeterminada.',err);}
 }
 async function hydrateFromAccount(){
  if(!window.raicesSupabase)return;
  try{
   const {data}=await window.raicesSupabase.auth.getUser();
   const user=data?.user;if(!user)return;
   const meta=user.user_metadata||{};
   const accountName=[meta.first_name,meta.last_name].filter(Boolean).join(' ').trim()||String(meta.full_name||meta.name||'').trim();
   const nameInput=document.getElementById('checkoutName'),emailInput=document.getElementById('checkoutEmail');
   if(nameInput&&accountName){nameInput.value=accountName;nameInput.readOnly=true;nameInput.dataset.fromAccount='true';}
   if(emailInput&&user.email){emailInput.value=user.email;emailInput.readOnly=true;emailInput.dataset.fromAccount='true';}
   const phoneInput=document.getElementById('checkoutPhone');if(phoneInput&&!digitalOnly&&!phoneInput.value&&meta.phone)phoneInput.value=String(meta.phone);
   render();
  }catch(err){console.warn('No se pudo completar el checkout desde la cuenta.',err);}
 }
 ['checkoutName','checkoutEmail','checkoutPhone','checkoutApt','checkoutNotes','checkoutDigitalState','checkoutDigitalZip'].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',render);e.addEventListener('blur',render)}});
 ['fulfillmentLocal','fulfillmentShipping'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('change',()=>{if(el.checked){selectedFulfillment=id==='fulfillmentShipping'?'shipping':'delivery';localStorage.setItem('raices_fulfillment_method',selectedFulfillment);if(selectedFulfillment!=='shipping'){shippingRates=[];shippingShipmentId='';selectedShippingRateId='';shippingRateError='';lastShippingQuoteKey='';}render();}})});
 const shippingRatesHost=document.getElementById('checkoutShippingRates');
 if(shippingRatesHost)shippingRatesHost.addEventListener('change',e=>{const input=e.target.closest('input[name="shippingRate"]');if(input){selectedShippingRateId=input.value;render();}});
 if(shippingRatesHost)shippingRatesHost.addEventListener('click',e=>{if(e.target.closest('.checkout-shipping-retry')){shippingRateError='';lastShippingQuoteKey='';loadShippingRates(true);}});

 const payButton=document.getElementById('previewPayButton');
 const termsCheckbox=document.getElementById('checkoutTerms');
 const payMessage=document.getElementById('checkoutPaymentMessage');
 function paymentMessage(text,state='idle'){if(!payMessage)return;payMessage.hidden=false;payMessage.dataset.state=state;payMessage.textContent=text;}
 applyCheckoutLanguage();
 applyDigitalCheckoutMode();
 if(termsCheckbox)termsCheckbox.addEventListener('change',()=>{if(termsCheckbox.checked&&payMessage?.dataset.state==='error')payMessage.hidden=true;});
 if(payButton)payButton.addEventListener('click',async()=>{
  const data=save();
  if(!items.length){paymentMessage(tr('Tu carrito está vacío.','Your cart is empty.'),'error');return;}
  if(!data.name){paymentMessage('Escribe tu nombre y apellido para continuar.','error');document.getElementById('checkoutName')?.focus();return;}
  if(!/^\S+@\S+\.\S+$/.test(data.email)){paymentMessage('Escribe un correo electrónico válido para continuar.','error');document.getElementById('checkoutEmail')?.focus();return;}
  if(digitalOnly&&(!data.digitalState||zipNorm(data.digitalZip).length!==5)){paymentMessage('Selecciona el estado y escribe un ZIP de facturación válido para calcular el sales tax.','error');document.getElementById('checkoutDigitalZip')?.focus();return;}
  if(!digitalOnly&&!data.phone){paymentMessage('Completa el número de teléfono para continuar.','error');document.getElementById('checkoutPhone')?.focus();return;}
  if(!digitalOnly&&!addressVerified){paymentMessage('Selecciona una dirección completa de las sugerencias de Google para continuar.','error');document.getElementById('checkoutGoogleAddressHost')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(!digitalOnly&&(!deliveryConfigReady||!fulfillmentOptionsReady)){paymentMessage('No se pudieron cargar las opciones de entrega. Recarga la página e intenta nuevamente.','error');return;}
  const selectedZone=digitalOnly?true:zoneFor(zipNorm(data.zip));
  if(!digitalOnly&&selectedFulfillment==='delivery'&&!localDeliveryEligible){paymentMessage('Este carrito no está habilitado para Delivery local.','error');return;}
  if(!digitalOnly&&selectedFulfillment==='delivery'&&!selectedZone){paymentMessage(shippingEligible?tr('Esta dirección está fuera del Delivery local. Selecciona Shipping para continuar.','This address is outside Local Delivery. Select Shipping to continue.'):'La dirección seleccionada está fuera de nuestra zona de entrega.','error');document.getElementById('checkoutGoogleAddressHost')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(!digitalOnly&&selectedFulfillment==='shipping'&&!shippingEligible){paymentMessage(tr('Uno o más productos todavía no están preparados para Shipping.','One or more products are not yet prepared for Shipping.'),'error');return;}
  if(!digitalOnly&&selectedFulfillment==='shipping'&&!shippingStateAllowed(data.state)){paymentMessage(tr('Shipping no está habilitado para este destino.','Shipping is not available for this destination.'),'error');return;}
  const chosenRate=selectedShippingRate();
  if(!digitalOnly&&selectedFulfillment==='shipping'&&(!chosenRate||!shippingShipmentId)){paymentMessage(tr('Selecciona una opción de Shipping para continuar.','Select a Shipping option to continue.'),'error');return;}
  if(!termsCheckbox?.checked){paymentMessage('Debes aceptar los Términos y las políticas de compra antes de continuar al pago.','error');termsCheckbox?.focus();return;}
  payButton.disabled=true;payButton.textContent=tr('PREPARANDO PAGO…','PREPARING PAYMENT…');paymentMessage(tr('Serás dirigido a una página de pago segura para completar tu compra.','You will be redirected to a secure payment page to complete your purchase.'),'idle');
  try{
   const res=await fetch('/.netlify/functions/create-square-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    items:items.map(i=>({sku:i.sku,qty:i.qty,variant:i.variant||''})),
    acceptedTerms:true,
    fulfillmentType:digitalOnly?'digital':selectedFulfillment,
    shippingRateId:(!digitalOnly&&selectedFulfillment==='shipping')?selectedShippingRate()?.id:null,
    shippingShipmentId:(!digitalOnly&&selectedFulfillment==='shipping')?shippingShipmentId:null,
    customer:digitalOnly?{name:data.name,email:data.email,state:data.digitalState,zip:zipNorm(data.digitalZip)}:{...data,addressVerified,placeId:document.getElementById('checkoutPlaceId')?.value||data.placeId}
   })});
   const body=await res.json().catch(()=>({}));
   if(!res.ok||!body.checkoutUrl){const detail=body.details?.[0]?.detail||body.details?.[0]?.code||'';throw new Error(detail?`${body.error||'CHECKOUT_UNAVAILABLE'}: ${detail}`:(body.error||'CHECKOUT_UNAVAILABLE'));}
   const pendingCheckout={id:body.checkoutId,checkoutId:body.checkoutId,environment:body.environment,fulfillmentType:body.fulfillmentType,createdAt:new Date().toISOString()};sessionStorage.setItem('raices_pending_order',JSON.stringify(pendingCheckout));localStorage.setItem('raices_pending_order',JSON.stringify(pendingCheckout));
   window.location.assign(body.checkoutUrl);
  }catch(err){
   console.error('Square checkout error',err);
   const code=String(err.message||'').split(':')[0];
   const messages={
    EMPTY_CART:tr('Tu carrito está vacío.','Your cart is empty.'),DELIVERY_OUTSIDE_COVERAGE:'La dirección está fuera de cobertura.',ADDRESS_NOT_VERIFIED:tr('Selecciona una dirección completa de las sugerencias de Google.','Select a complete address from Google suggestions.'),DELIVERY_DATA_INCOMPLETE:'Completa el teléfono y todos los datos de entrega.',PRODUCT_NOT_AVAILABLE:'Uno de los productos ya no está disponible.',INSUFFICIENT_STOCK:'No hay inventario suficiente.',LIVE_SALES_DISABLED:'Las ventas reales todavía no están habilitadas.',SQUARE_CONFIGURATION_MISSING:'Falta completar la configuración de Square.',DELIVERY_CONFIG_UNAVAILABLE:'No se pudo cargar la configuración de delivery. Intenta nuevamente.',LOCAL_DELIVERY_NOT_AVAILABLE_FOR_CART:'Este carrito no admite Delivery local.',SHIPPING_DISABLED:tr('Shipping todavía está desactivado en NURAI.','Shipping is still disabled in NURAI.'),SHIPPING_NOT_AVAILABLE_FOR_CART:'Uno o más productos no están habilitados para Shipping.',SHIPPING_PRODUCT_SETUP_INCOMPLETE:'Falta peso o perfil de empaque en uno de los productos.',SHIPPING_DESTINATION_NOT_ALLOWED:tr('Shipping no está habilitado para este destino.','Shipping is not available for this destination.'),SHIPPO_TOKEN_MISSING:tr('La conexión con Shippo no está disponible.','The Shippo connection is unavailable.'),SHIPPING_RATE_REQUIRED:tr('Selecciona una opción de Shipping.','Select a Shipping option.'),SHIPPING_RATE_INVALID:tr('La tarifa de Shipping expiró o cambió. Vuelve a calcularla.','The Shipping rate expired or changed. Recalculate it.'),SHIPPING_RATE_UNAVAILABLE:tr('No se pudo validar la tarifa de Shipping.','The Shipping rate could not be validated.'),TAX_RULE_NOT_CONFIGURED:'No hay una regla activa de Sales Tax para este estado. Revisa Configuración → Pagos en NURAI.',SQUARE_TAX_CALCULATION_FAILED:'Square no pudo validar el cálculo del tax. Intenta nuevamente.',TAX_CALCULATION_MISMATCH:'El cálculo fiscal no coincidió con Square y el pago fue bloqueado por seguridad.',DIGITAL_TAX_REVIEW_REQUIRED:'Este producto digital todavía está en revisión fiscal.',DIGITAL_FILE_MISSING:'Este producto digital todavía no tiene su archivo PDF cargado. Intenta nuevamente más tarde.',CHECKOUT_UNAVAILABLE:'No se pudo iniciar el pago. Intenta nuevamente.'
   };
   paymentMessage(messages[code]||messages.CHECKOUT_UNAVAILABLE,'error');payButton.disabled=false;payButton.textContent=tr('CONTINUAR AL PAGO','CONTINUE TO PAYMENT');
  }
 });
 (async()=>{await Promise.all([loadDeliveryConfig(),loadFulfillmentOptions()]);render();hydrateFromAccount();loadDefaultAddress();if(!digitalOnly)initAddressAutocomplete();})();
})();
