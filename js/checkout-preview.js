(function(){
 const money=n=>`$${Number(n||0).toFixed(2)}`, zipNorm=v=>String(v||'').replace(/\D/g,'').slice(0,5);
 let summary={};try{summary=JSON.parse(localStorage.getItem('raices_cart_summary')||'{}')}catch(e){}
 const items=summary.items||[], cfg=window.RAICES_STORE_CONFIG||{}, rules=cfg.ORDER_RULES||{}, zones=cfg.DELIVERY?.zones||[];
 const isDigitalItem=i=>{const sku=String(i?.sku||'').toUpperCase();const name=String(i?.name||'');return sku.startsWith('RA-LB-')||/volver a lo esencial|21 días|21 dias|cocina desde la raíz|cocina desde la raiz|rituales/i.test(name);};
 const hasPhysicalItems=items.some(i=>!isDigitalItem(i));
 const digitalOnly=items.length>0&&!hasPhysicalItems;
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
 function render(){const data=save(),zip=zipNorm(data.zip),zone=digitalOnly?{name:'Entrega digital',fee:0}:(addressVerified&&zip.length===5?zoneFor(zip):null),subtotal=Number(summary.subtotal||0),physicalSubtotal=items.filter(i=>!isDigitalItem(i)).reduce((sum,i)=>sum+Number(i.lineTotal||((i.qty||0)*Number(i.price||0))),0),freeAt=Number(rules.freeDeliveryThreshold||0),qualifies=hasPhysicalItems&&freeAt>0&&physicalSubtotal>=freeAt,delivery=digitalOnly?0:(zone&&items.length?(qualifies?0:Number(zone.fee||0)):0);
  previewSubtotal.textContent=money(subtotal);previewDelivery.textContent=digitalOnly?'No aplica':(zone?(qualifies?'Gratis':money(delivery)):'—');previewTotal.textContent=money(subtotal+delivery);checkoutEta.textContent=digitalOnly?'Acceso digital después de confirmar el pago.':(items.length?`${eta()} · normalmente dentro de 24–48 horas.`:'Agrega productos para calcular la entrega.');
  const left=Math.max(0,freeAt-physicalSubtotal);freeDeliveryProgress.textContent=digitalOnly?'Los productos digitales no tienen cargo de delivery.':(!freeAt?'':qualifies?'Has desbloqueado delivery gratis.':`Agrega ${money(left)} más en productos físicos para delivery gratis.`);
  const status=document.getElementById('checkoutGoogleAddressStatus');if(status){status.dataset.state=addressVerified?'ok':'idle';status.textContent=addressVerified?'Dirección verificada por Google.':'Selecciona una dirección completa de las sugerencias de Google.'}
  const msg=checkoutDeliveryMessage;if(!items.length){msg.dataset.state='error';msg.textContent='Tu carrito está vacío.'}else if(digitalOnly){msg.dataset.state='ok';msg.textContent='Producto digital: no requiere dirección ni tiene cargo de delivery.'}else if(!addressVerified){msg.dataset.state='idle';msg.textContent='Selecciona primero una dirección válida de Google para confirmar la cobertura.'}else if(!zone){msg.dataset.state='error';msg.textContent=`La dirección seleccionada (ZIP ${zip}) está fuera de la cobertura configurada.`}else{msg.dataset.state='ok';msg.textContent=`Cobertura confirmada: ${zone.name}. ${qualifies?'Delivery gratis.':`Delivery estimado ${money(delivery)}.`}`}
  const payButton=document.getElementById('previewPayButton');if(payButton){payButton.disabled=!items.length;payButton.textContent='CONTINUAR AL PAGO';}
  summary={...summary,delivery:{zip:digitalOnly?'00000':zip,valid:digitalOnly||!!zone&&addressVerified,zone:zone?.name||'',cost:delivery,digitalOnly},deliveryCost:delivery,total:subtotal+delivery,customer:data,addressVerified,estimatedDelivery:eta()};localStorage.setItem('raices_cart_summary',JSON.stringify(summary));
 }
 function applyDigitalCheckoutMode(){
  document.querySelectorAll('[data-delivery-field]').forEach(el=>{el.hidden=digitalOnly;el.style.display=digitalOnly?'none':'';el.setAttribute('aria-hidden',digitalOnly?'true':'false');});
  const deliveryBlock=document.getElementById('checkoutDeliveryBlock');if(deliveryBlock){deliveryBlock.hidden=digitalOnly;deliveryBlock.style.display=digitalOnly?'none':'';deliveryBlock.setAttribute('aria-hidden',digitalOnly?'true':'false');}
  const phone=document.getElementById('checkoutPhone');if(phone){phone.required=!digitalOnly;if(digitalOnly)phone.value='';}
  if(digitalOnly){['checkoutAddress','checkoutApt','checkoutCity','checkoutState','checkoutZip','checkoutNotes','checkoutPlaceId','checkoutLatitude','checkoutLongitude'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});addressVerified=false;}
  const heading=document.querySelector('.checkout-form-card h2');if(heading)heading.textContent=digitalOnly?'Información de contacto':'Contacto y entrega';
  const intro=document.querySelector('.checkout-preview-intro p:last-child');if(intro)intro.textContent=digitalOnly?'Solo necesitamos tu nombre y correo electrónico para completar la compra.':'Revisa tus datos antes de continuar al pago.';
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
 ['checkoutName','checkoutEmail','checkoutPhone','checkoutApt','checkoutNotes'].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',render);e.addEventListener('blur',render)}});
 const payButton=document.getElementById('previewPayButton');
 const termsCheckbox=document.getElementById('checkoutTerms');
 const payMessage=document.getElementById('checkoutPaymentMessage');
 function paymentMessage(text,state='idle'){if(!payMessage)return;payMessage.hidden=false;payMessage.dataset.state=state;payMessage.textContent=text;}
 applyDigitalCheckoutMode();
 if(termsCheckbox)termsCheckbox.addEventListener('change',()=>{if(termsCheckbox.checked&&payMessage?.dataset.state==='error')payMessage.hidden=true;});
 if(payButton)payButton.addEventListener('click',async()=>{
  const data=save();
  if(!items.length){paymentMessage('Tu carrito está vacío.','error');return;}
  if(!data.name){paymentMessage('Escribe tu nombre y apellido para continuar.','error');document.getElementById('checkoutName')?.focus();return;}
  if(!/^\S+@\S+\.\S+$/.test(data.email)){paymentMessage('Escribe un correo electrónico válido para continuar.','error');document.getElementById('checkoutEmail')?.focus();return;}
  if(!digitalOnly&&!data.phone){paymentMessage('Completa el número de teléfono para continuar.','error');document.getElementById('checkoutPhone')?.focus();return;}
  if(!digitalOnly&&!addressVerified){paymentMessage('Selecciona una dirección de entrega completa de las sugerencias de Google para continuar.','error');document.getElementById('checkoutGoogleAddressHost')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  const selectedZone=digitalOnly?true:zoneFor(zipNorm(data.zip));
  if(!digitalOnly&&!selectedZone){paymentMessage('La dirección seleccionada está fuera de nuestra zona de entrega.','error');document.getElementById('checkoutGoogleAddressHost')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(!termsCheckbox?.checked){paymentMessage('Debes aceptar los Términos y las políticas de compra antes de continuar al pago.','error');termsCheckbox?.focus();return;}
  payButton.disabled=true;payButton.textContent='PREPARANDO PAGO…';paymentMessage('Serás dirigido a una página de pago segura para completar tu compra.','idle');
  try{
   const res=await fetch('/.netlify/functions/create-square-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items.map(i=>({sku:i.sku,qty:i.qty,variant:i.variant||''})),acceptedTerms:true,customer:digitalOnly?{name:data.name,email:data.email}:{...data,addressVerified,placeId:document.getElementById('checkoutPlaceId')?.value||data.placeId}})});
   const body=await res.json().catch(()=>({}));
   if(!res.ok||!body.checkoutUrl){const detail=body.details?.[0]?.detail||body.details?.[0]?.code||'';throw new Error(detail?`${body.error||'CHECKOUT_UNAVAILABLE'}: ${detail}`:(body.error||'CHECKOUT_UNAVAILABLE'));}
   sessionStorage.setItem('raices_pending_order',JSON.stringify({id:body.orderId,orderNumber:body.orderNumber,environment:body.environment}));
   window.location.assign(body.checkoutUrl);
  }catch(err){console.error('Square checkout error',err);const messages={EMPTY_CART:'Tu carrito está vacío.',DELIVERY_OUTSIDE_COVERAGE:'La dirección está fuera de cobertura.',ADDRESS_NOT_VERIFIED:'Selecciona una dirección de entrega completa de las sugerencias de Google.',DELIVERY_DATA_INCOMPLETE:'Completa el teléfono y todos los datos de entrega.',PRODUCT_NOT_AVAILABLE:'Uno de los productos ya no está disponible.',INSUFFICIENT_STOCK:'No hay inventario suficiente.',LIVE_SALES_DISABLED:'Las ventas reales todavía no están habilitadas.',SQUARE_CONFIGURATION_MISSING:'Falta completar la configuración de Square.',CHECKOUT_UNAVAILABLE:'No se pudo iniciar el pago. Intenta nuevamente.'};paymentMessage(messages[err.message]||messages.CHECKOUT_UNAVAILABLE,'error');payButton.disabled=false;payButton.textContent='CONTINUAR AL PAGO';}
 });
 render();hydrateFromAccount();if(!digitalOnly)initAddressAutocomplete();
})();
