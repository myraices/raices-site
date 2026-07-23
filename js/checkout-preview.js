(function(){
 const money=n=>`$${Number(n||0).toFixed(2)}`, zipNorm=v=>String(v||'').replace(/\D/g,'').slice(0,5);
 let summary={};try{summary=JSON.parse(localStorage.getItem('raices_cart_summary')||'{}')}catch(e){}
 const items=summary.items||[], cfg=window.RAICES_STORE_CONFIG||{}, rules=cfg.ORDER_RULES||{}, zones=cfg.DELIVERY?.zones||[];
 const itemsEl=document.getElementById('previewItems');
 itemsEl.innerHTML=items.length?items.map(i=>`<div class="preview-item"><span>${i.qty} × ${i.name||i.sku}${i.variant?` · ${i.variant}`:''}</span><strong>${money(i.lineTotal||((i.qty||0)*Number(i.price||0)))}</strong></div>`).join(''):'<div class="preview-empty">Tu carrito está vacío. Regresa a la tienda para agregar productos.</div>';
 const fields={name:'checkoutName',email:'checkoutEmail',phone:'checkoutPhone',address:'checkoutAddress',apt:'checkoutApt',city:'checkoutCity',state:'checkoutState',zip:'checkoutZip',notes:'checkoutNotes',placeId:'checkoutPlaceId',latitude:'checkoutLatitude',longitude:'checkoutLongitude'};
 let saved={};try{saved=JSON.parse(localStorage.getItem('raices_checkout_customer')||'{}')}catch(e){}
 let addressVerified=Boolean(saved.placeId&&saved.address&&saved.city&&saved.state&&saved.zip);
 Object.entries(fields).forEach(([k,id])=>{const e=document.getElementById(id);if(e)e.value=saved[k]||((k==='state')?'TX':'')});
 const zoneFor=z=>zones.find(x=>(x.zips||[]).includes(z)||(x.prefixes||[]).some(p=>z.startsWith(p)));
 const componentValue=(components,type,shortName=false)=>{const item=(components||[]).find(c=>(c.types||[]).includes(type));if(!item)return'';return shortName?(item.shortText||item.short_name||''):(item.longText||item.long_name||item.shortText||'')};
 function loadGoogleMaps(){
  if(window.google?.maps?.importLibrary)return Promise.resolve();
  const key=window.RAICES_GOOGLE_MAPS_API_KEY;
  if(!key||key.includes('__GOOGLE_')||key.includes('PASTE_YOUR_'))return Promise.reject(new Error('MAPS_KEY_MISSING'));
  ((g)=>{var h,a,k,p='The Google Maps JavaScript API',c='google',l='importLibrary',q='__ib__',m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await(a=m.createElement('script'));e.set('libraries',[...r]+'');for(k in g)e.set(k.replace(/[A-Z]/g,t=>'_'+t[0].toLowerCase()),g[k]);e.set('callback',c+'.maps.'+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+' could not load.'));a.nonce=m.querySelector('script[nonce]')?.nonce||'';m.head.append(a)}));d[l]?console.warn(p+' only loads once. Ignoring:',g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key,v:'weekly',language:'es',region:'US'});
  return Promise.resolve();
 }
 function save(){const d={};Object.entries(fields).forEach(([k,id])=>d[k]=document.getElementById(id)?.value.trim()||'');d.addressVerified=addressVerified;localStorage.setItem('raices_checkout_customer',JSON.stringify(d));return d}
 function eta(){const d=new Date();d.setHours(d.getHours()+Number(rules.estimatedDeliveryMinHours||24));const e=new Date();e.setHours(e.getHours()+Number(rules.estimatedDeliveryMaxHours||48));const f=x=>x.toLocaleDateString('es-US',{weekday:'short',month:'short',day:'numeric'});return `${f(d)} – ${f(e)}`}
 function render(){const data=save(),zip=zipNorm(data.zip),zone=addressVerified&&zip.length===5?zoneFor(zip):null,subtotal=Number(summary.subtotal||0),freeAt=Number(rules.freeDeliveryThreshold||0),qualifies=freeAt>0&&subtotal>=freeAt,delivery=zone&&items.length?(qualifies?0:Number(zone.fee||0)):0;
  previewSubtotal.textContent=money(subtotal);previewDelivery.textContent=zone?(qualifies?'Gratis':money(delivery)):'—';previewTotal.textContent=money(subtotal+delivery);checkoutEta.textContent=items.length?`${eta()} · normalmente dentro de 24–48 horas.`:'Agrega productos para calcular la entrega.';
  const left=Math.max(0,freeAt-subtotal);freeDeliveryProgress.textContent=!freeAt?'':qualifies?'Has desbloqueado delivery gratis.':`Agrega ${money(left)} más para delivery gratis.`;
  const status=document.getElementById('checkoutGoogleAddressStatus');if(status){status.dataset.state=addressVerified?'ok':'idle';status.textContent=addressVerified?'Dirección verificada por Google.':'Selecciona una dirección completa de las sugerencias de Google.'}
  const msg=checkoutDeliveryMessage;if(!items.length){msg.dataset.state='error';msg.textContent='Tu carrito está vacío.'}else if(!addressVerified){msg.dataset.state='idle';msg.textContent='Selecciona primero una dirección válida de Google para confirmar la cobertura.'}else if(!zone){msg.dataset.state='error';msg.textContent=`La dirección seleccionada (ZIP ${zip}) está fuera de la cobertura configurada.`}else{msg.dataset.state='ok';msg.textContent=`Cobertura confirmada: ${zone.name}. ${qualifies?'Delivery gratis.':`Delivery estimado ${money(delivery)}.`}`}
  const payButton=document.getElementById('previewPayButton');if(payButton){payButton.disabled=!(items.length&&addressVerified&&zone&&data.name&&data.email);payButton.textContent='Continuar a Square Sandbox';}
  summary={...summary,delivery:{zip,valid:!!zone&&addressVerified,zone:zone?.name||'',cost:delivery},deliveryCost:delivery,total:subtotal+delivery,customer:data,addressVerified,estimatedDelivery:eta()};localStorage.setItem('raices_cart_summary',JSON.stringify(summary));
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
 ['checkoutName','checkoutEmail','checkoutPhone','checkoutApt','checkoutNotes'].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',render);e.addEventListener('blur',render)}});
 const payButton=document.getElementById('previewPayButton');
 const payMessage=document.getElementById('checkoutPaymentMessage');
 function paymentMessage(text,state='idle'){if(!payMessage)return;payMessage.hidden=false;payMessage.dataset.state=state;payMessage.textContent=text;}
 if(payButton)payButton.addEventListener('click',async()=>{
  const data=save();
  if(payButton.disabled)return;
  payButton.disabled=true;payButton.textContent='Creando checkout seguro…';paymentMessage('Conectando con Square Sandbox…','idle');
  try{
   const res=await fetch('/.netlify/functions/create-square-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items.map(i=>({sku:i.sku,qty:i.qty,variant:i.variant||''})),customer:{...data,addressVerified,placeId:document.getElementById('checkoutPlaceId')?.value||data.placeId}})});
   const body=await res.json().catch(()=>({}));
   if(!res.ok||!body.checkoutUrl)throw new Error(body.error||'CHECKOUT_UNAVAILABLE');
   sessionStorage.setItem('raices_pending_order',JSON.stringify({id:body.orderId,orderNumber:body.orderNumber,environment:body.environment}));
   window.location.assign(body.checkoutUrl);
  }catch(err){console.error('Square checkout error',err);const messages={EMPTY_CART:'Tu carrito está vacío.',DELIVERY_OUTSIDE_COVERAGE:'La dirección está fuera de cobertura.',ADDRESS_NOT_VERIFIED:'Selecciona una dirección verificada.',PRODUCT_NOT_AVAILABLE:'Uno de los productos ya no está disponible.',INSUFFICIENT_STOCK:'No hay inventario suficiente.',LIVE_SALES_DISABLED:'Las ventas reales todavía no están habilitadas.',SQUARE_CONFIGURATION_MISSING:'Falta completar la configuración de Square.',CHECKOUT_UNAVAILABLE:'No se pudo iniciar el pago. Intenta nuevamente.'};paymentMessage(messages[err.message]||messages.CHECKOUT_UNAVAILABLE,'error');payButton.disabled=false;payButton.textContent='Continuar a Square Sandbox';}
 });
 render();initAddressAutocomplete();
})();
