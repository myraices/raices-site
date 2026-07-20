(function(){
  const money=n=>`$${Number(n||0).toFixed(2)}`;
  const normalizeZip=v=>String(v||'').replace(/\D/g,'').slice(0,5);
  let summary={}; try{summary=JSON.parse(localStorage.getItem('raices_cart_summary')||'{}')}catch(e){}
  const items=summary.items||[];
  const itemsEl=document.getElementById('previewItems');
  itemsEl.innerHTML=items.length?items.map(i=>`<div class="preview-item"><span>${i.qty} × ${i.name||i.sku}${i.variant?` · ${i.variant}`:''}</span><strong>${money(i.lineTotal||((i.qty||0)*Number(i.price||0)))}</strong></div>`).join(''):'<div class="preview-empty">Tu carrito está vacío. Regresa a la tienda para agregar productos.</div>';
  const fields={name:'checkoutName',email:'checkoutEmail',phone:'checkoutPhone',address:'checkoutAddress',apt:'checkoutApt',city:'checkoutCity',zip:'checkoutZip',notes:'checkoutNotes'};
  let saved={}; try{saved=JSON.parse(localStorage.getItem('raices_checkout_customer')||'{}')}catch(e){}
  if(!saved.zip) saved.zip=summary.delivery?.zip||localStorage.getItem('raices_delivery_zip')||'';
  Object.entries(fields).forEach(([key,id])=>{const el=document.getElementById(id);if(el)el.value=saved[key]||'';});
  const zones=window.RAICES_STORE_CONFIG?.DELIVERY?.zones||[];
  function zoneFor(zip){return zones.find(z=>(z.zips||[]).includes(zip)||(z.prefixes||[]).some(p=>zip.startsWith(p)));}
  function save(){const data={};Object.entries(fields).forEach(([key,id])=>data[key]=document.getElementById(id)?.value.trim()||'');localStorage.setItem('raices_checkout_customer',JSON.stringify(data));return data;}
  function render(){const data=save();const zip=normalizeZip(data.zip);const zone=zip.length===5?zoneFor(zip):null;const subtotal=Number(summary.subtotal||0);const delivery=zone&&items.length?Number(zone.fee||0):0;document.getElementById('previewSubtotal').textContent=money(subtotal);document.getElementById('previewDelivery').textContent=zone?money(delivery):'—';document.getElementById('previewTotal').textContent=money(subtotal+delivery);const msg=document.getElementById('checkoutDeliveryMessage');if(!items.length){msg.dataset.state='error';msg.textContent='Tu carrito está vacío.';}else if(zip.length<5){msg.dataset.state='idle';msg.textContent='Ingresa los 5 dígitos del ZIP Code para confirmar cobertura.';}else if(!zone){msg.dataset.state='error';msg.textContent=`El ZIP ${zip} está fuera de la cobertura configurada. Antes del lanzamiento podremos revisar solicitudes especiales.`;}else{msg.dataset.state='ok';msg.textContent=`Cobertura confirmada: ${zone.name}. Delivery estimado ${money(delivery)}.`;}summary={...summary,delivery:{zip,valid:!!zone,zone:zone?.name||'',cost:delivery},deliveryCost:delivery,total:subtotal+delivery,customer:data};localStorage.setItem('raices_cart_summary',JSON.stringify(summary));}
  Object.values(fields).forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('input',()=>{if(id==='checkoutZip')el.value=normalizeZip(el.value);render();});el.addEventListener('blur',render);}});render();
})();