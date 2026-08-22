(function(){
 const money=n=>`$${Number(n||0).toFixed(2)}`, zipNorm=v=>String(v||'').replace(/\D/g,'').slice(0,5);
 let summary={};try{summary=JSON.parse(localStorage.getItem('raices_cart_summary')||'{}')}catch(e){}
 const items=summary.items||[], cfg=window.RAICES_STORE_CONFIG||{}, rules=cfg.ORDER_RULES||{};
 let zones=[], deliveryConfigReady=false, fulfillmentOptionsReady=false, localDeliveryEligible=true, shippingEligible=false, shippingEnabled=false, shippingAllowedStates=[], shippingRateMode="carrier_required", shippingSetupProblems=[];
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
   shippingRateMode=String(body.shippingRateMode||'carrier_required');
   shippingSetupProblems=Array.isArray(body.shippingSetupProblems)?body.shippingSetupProblems:[];
   if(selectedFulfillment==='shipping'&&!shippingEligible)selectedFulfillment=localDeliveryEligible?'delivery':'shipping';
   if(selectedFulfillment==='delivery'&&!localDeliveryEligible&&shippingEligible)selectedFulfillment='shipping';
   fulfillmentOptionsReady=true;
  }catch(err){
   console.error('Raíces fulfillment options error',err);
   fulfillmentOptionsReady=false;shippingEligible=false;
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
  const delivery=digitalOnly?0:(isShipping?0:(zone&&items.length?(qualifies?0:Number(zone.fee||0)):0));

  const methodBlock=document.getElementById('checkoutFulfillmentBlock');
  const localRow=document.getElementById('fulfillmentLocalRow');
  const shippingRow=document.getElementById('fulfillmentShippingRow');
  const localRadio=document.getElementById('fulfillmentLocal');
  const shippingRadio=document.getElementById('fulfillmentShipping');
  const methodStatus=document.getElementById('checkoutFulfillmentStatus');
  if(methodBlock){methodBlock.hidden=digitalOnly;methodBlock.style.display=digitalOnly?'none':'';}
  if(localRow)localRow.hidden=!localDeliveryEligible;
  if(shippingRow)shippingRow.hidden=!shippingEligible;
  if(localRadio){localRadio.checked=selectedFulfillment==='delivery';localRadio.disabled=!localDeliveryEligible;}
  if(shippingRadio){shippingRadio.checked=selectedFulfillment==='shipping';shippingRadio.disabled=!shippingEligible;}
  if(methodStatus&&!digitalOnly){
   if(!fulfillmentOptionsReady)methodStatus.textContent='Cargando métodos disponibles…';
   else if(localDeliveryEligible&&shippingEligible)methodStatus.textContent='Puedes elegir delivery local o shipping nacional según la dirección.';
   else if(shippingEligible)methodStatus.textContent='Este carrito está habilitado para shipping nacional.';
   else if(localDeliveryEligible)methodStatus.textContent=shippingEnabled?'Este carrito requiere delivery local; uno o más productos no están habilitados para shipping.':'Shipping nacional todavía no está activado.';
   else methodStatus.textContent='No hay un método de entrega disponible para este carrito.';
  }

  previewSubtotal.textContent=money(subtotal);
  const feeLabel=document.getElementById('previewFulfillmentLabel');if(feeLabel)feeLabel.textContent=digitalOnly?'Entrega':(isShipping?'Shipping':'Delivery');
  previewDelivery.textContent=digitalOnly?'No aplica':(isShipping?(shippingRateMode==='sandbox_zero_test'?'$0.00 · prueba':'Pendiente'):(zone?(qualifies?'Gratis':money(delivery)):'—'));
  previewTotal.textContent=money(subtotal+delivery);
  checkoutEta.textContent=digitalOnly?'Acceso digital después de confirmar el pago.':isShipping?(shippingRateMode==='sandbox_zero_test'?'Prueba de Shipping en Sandbox. La tarifa real se calculará con Shippo en la siguiente fase.':'La fecha estimada se mostrará al calcular la tarifa del transportista.'):(items.length?`${eta()} · normalmente dentro de 24–48 horas.`:'Agrega productos para calcular la entrega.');
  const left=Math.max(0,freeAt-physicalSubtotal);
  freeDeliveryProgress.textContent=digitalOnly?'Los productos digitales no tienen cargo de delivery.':isShipping?'La promoción de Delivery local no aplica al Shipping nacional.':(!freeDeliveryEnabled?'':!freeDeliveryActive?(freeDeliveryStartDate?`Delivery gratis disponible desde ${freeDeliveryStartDate}.`:''):freeAt===0?'Delivery gratis en todas las compras físicas.':qualifies?'Has desbloqueado delivery gratis.':`Agrega ${money(left)} más en productos físicos para delivery gratis.`);

  const status=document.getElementById('checkoutGoogleAddressStatus');if(status){status.dataset.state=addressVerified?'ok':'idle';status.textContent=addressVerified?'Dirección verificada por Google.':'Selecciona una dirección completa de las sugerencias de Google.'}
  const msg=checkoutDeliveryMessage;
  if(!items.length){msg.dataset.state='error';msg.textContent='Tu carrito está vacío.'}
  else if(digitalOnly){msg.dataset.state='ok';msg.textContent='Producto digital: no requiere dirección ni tiene cargo de delivery.'}
  else if(!deliveryConfigReady||!fulfillmentOptionsReady){msg.dataset.state='idle';msg.textContent='Cargando opciones de entrega…'}
  else if(!addressVerified){msg.dataset.state='idle';msg.textContent='Selecciona primero una dirección válida de Google para confirmar las opciones disponibles.'}
  else if(isShipping&&!shippingDestinationOk){msg.dataset.state='error';msg.textContent='Shipping no está habilitado para este destino.'}
  else if(isShipping){msg.dataset.state='ok';msg.textContent=shippingRateMode==='sandbox_zero_test'?'Shipping nacional habilitado para prueba Sandbox. Tarifa provisional $0; todavía no se usa Shippo.':'Shipping nacional disponible. La tarifa del transportista se calculará antes del pago.'}
  else if(!zone){msg.dataset.state='error';msg.textContent=shippingEligible?'Esta dirección está fuera del Delivery local. Selecciona Shipping nacional para continuar.':`La dirección seleccionada (ZIP ${zip}) está fuera de la cobertura configurada.`}
  else{msg.dataset.state='ok';msg.textContent=`Cobertura confirmada: ${zone.name}. ${qualifies?'Delivery gratis.':`Delivery estimado ${money(delivery)}.`}`}

  const payButton=document.getElementById('previewPayButton');if(payButton){payButton.disabled=!items.length;payButton.textContent='CONTINUAR AL PAGO';}
  summary={...summary,fulfillmentType:digitalOnly?'digital':selectedFulfillment,delivery:{zip:digitalOnly?'00000':zip,valid:digitalOnly||(isShipping?shippingDestinationOk:!!zone&&addressVerified),zone:isShipping?'National Shipping':(zone?.name||''),cost:delivery,digitalOnly},deliveryCost:delivery,total:subtotal+delivery,customer:data,addressVerified,estimatedDelivery:isShipping?'Shipping nacional':eta()};
  localStorage.setItem('raices_cart_summary',JSON.stringify(summary));
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
 ['fulfillmentLocal','fulfillmentShipping'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('change',()=>{if(el.checked){selectedFulfillment=id==='fulfillmentShipping'?'shipping':'delivery';localStorage.setItem('raices_fulfillment_method',selectedFulfillment);render();}})});
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
  if(digitalOnly&&(!data.digitalState||zipNorm(data.digitalZip).length!==5)){paymentMessage('Selecciona el estado y escribe un ZIP de facturación válido para calcular el sales tax.','error');document.getElementById('checkoutDigitalZip')?.focus();return;}
  if(!digitalOnly&&!data.phone){paymentMessage('Completa el número de teléfono para continuar.','error');document.getElementById('checkoutPhone')?.focus();return;}
  if(!digitalOnly&&!addressVerified){paymentMessage('Selecciona una dirección completa de las sugerencias de Google para continuar.','error');document.getElementById('checkoutGoogleAddressHost')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(!digitalOnly&&(!deliveryConfigReady||!fulfillmentOptionsReady)){paymentMessage('No se pudieron cargar las opciones de entrega. Recarga la página e intenta nuevamente.','error');return;}
  const selectedZone=digitalOnly?true:zoneFor(zipNorm(data.zip));
  if(!digitalOnly&&selectedFulfillment==='delivery'&&!localDeliveryEligible){paymentMessage('Este carrito no está habilitado para Delivery local.','error');return;}
  if(!digitalOnly&&selectedFulfillment==='delivery'&&!selectedZone){paymentMessage(shippingEligible?'Esta dirección está fuera del Delivery local. Selecciona Shipping nacional para continuar.':'La dirección seleccionada está fuera de nuestra zona de entrega.','error');document.getElementById('checkoutGoogleAddressHost')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(!digitalOnly&&selectedFulfillment==='shipping'&&!shippingEligible){paymentMessage('Uno o más productos todavía no están preparados para Shipping nacional.','error');return;}
  if(!digitalOnly&&selectedFulfillment==='shipping'&&!shippingStateAllowed(data.state)){paymentMessage('Shipping nacional no está habilitado para este destino.','error');return;}
  if(!digitalOnly&&selectedFulfillment==='shipping'&&shippingRateMode!=='sandbox_zero_test'){paymentMessage('Shipping está preparado, pero todavía falta conectar Shippo para calcular la tarifa real antes del pago.','error');return;}
  if(!termsCheckbox?.checked){paymentMessage('Debes aceptar los Términos y las políticas de compra antes de continuar al pago.','error');termsCheckbox?.focus();return;}
  payButton.disabled=true;payButton.textContent='PREPARANDO PAGO…';paymentMessage('Serás dirigido a una página de pago segura para completar tu compra.','idle');
  try{
   const res=await fetch('/.netlify/functions/create-square-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    items:items.map(i=>({sku:i.sku,qty:i.qty,variant:i.variant||''})),
    acceptedTerms:true,
    fulfillmentType:digitalOnly?'digital':selectedFulfillment,
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
    EMPTY_CART:'Tu carrito está vacío.',DELIVERY_OUTSIDE_COVERAGE:'La dirección está fuera de cobertura.',ADDRESS_NOT_VERIFIED:'Selecciona una dirección completa de las sugerencias de Google.',DELIVERY_DATA_INCOMPLETE:'Completa el teléfono y todos los datos de entrega.',PRODUCT_NOT_AVAILABLE:'Uno de los productos ya no está disponible.',INSUFFICIENT_STOCK:'No hay inventario suficiente.',LIVE_SALES_DISABLED:'Las ventas reales todavía no están habilitadas.',SQUARE_CONFIGURATION_MISSING:'Falta completar la configuración de Square.',DELIVERY_CONFIG_UNAVAILABLE:'No se pudo cargar la configuración de delivery. Intenta nuevamente.',LOCAL_DELIVERY_NOT_AVAILABLE_FOR_CART:'Este carrito no admite Delivery local.',SHIPPING_DISABLED:'Shipping nacional todavía está desactivado en NURAI.',SHIPPING_NOT_AVAILABLE_FOR_CART:'Uno o más productos no están habilitados para Shipping.',SHIPPING_PRODUCT_SETUP_INCOMPLETE:'Falta peso o perfil de empaque en uno de los productos.',SHIPPING_DESTINATION_NOT_ALLOWED:'Shipping no está habilitado para este destino.',SHIPPING_RATE_UNAVAILABLE:'Falta conectar Shippo para calcular la tarifa real.',TAX_RULE_NOT_CONFIGURED:'No hay una regla activa de Sales Tax para este estado. Revisa Configuración → Pagos en NURAI.',SQUARE_TAX_CALCULATION_FAILED:'Square no pudo validar el cálculo del tax. Intenta nuevamente.',TAX_CALCULATION_MISMATCH:'El cálculo fiscal no coincidió con Square y el pago fue bloqueado por seguridad.',DIGITAL_TAX_REVIEW_REQUIRED:'Este producto digital todavía está en revisión fiscal.',DIGITAL_FILE_MISSING:'Este producto digital todavía no tiene su archivo PDF cargado. Intenta nuevamente más tarde.',CHECKOUT_UNAVAILABLE:'No se pudo iniciar el pago. Intenta nuevamente.'
   };
   paymentMessage(messages[code]||messages.CHECKOUT_UNAVAILABLE,'error');payButton.disabled=false;payButton.textContent='CONTINUAR AL PAGO';
  }
 });
 (async()=>{await Promise.all([loadDeliveryConfig(),loadFulfillmentOptions()]);render();hydrateFromAccount();loadDefaultAddress();if(!digitalOnly)initAddressAutocomplete();})();
})();
