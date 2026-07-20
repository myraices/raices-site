(function(){
 const money=n=>`$${Number(n||0).toFixed(2)}`, zipNorm=v=>String(v||'').replace(/\D/g,'').slice(0,5);
 let summary={};try{summary=JSON.parse(localStorage.getItem('raices_cart_summary')||'{}')}catch(e){}
 const items=summary.items||[], cfg=window.RAICES_STORE_CONFIG||{}, rules=cfg.ORDER_RULES||{}, zones=cfg.DELIVERY?.zones||[];
 const itemsEl=document.getElementById('previewItems');
 itemsEl.innerHTML=items.length?items.map(i=>`<div class="preview-item"><span>${i.qty} × ${i.name||i.sku}${i.variant?` · ${i.variant}`:''}</span><strong>${money(i.lineTotal||((i.qty||0)*Number(i.price||0)))}</strong></div>`).join(''):'<div class="preview-empty">Tu carrito está vacío. Regresa a la tienda para agregar productos.</div>';
 const fields={name:'checkoutName',email:'checkoutEmail',phone:'checkoutPhone',address:'checkoutAddress',apt:'checkoutApt',city:'checkoutCity',zip:'checkoutZip',notes:'checkoutNotes'};
 let saved={};try{saved=JSON.parse(localStorage.getItem('raices_checkout_customer')||'{}')}catch(e){}; if(!saved.zip)saved.zip=summary.delivery?.zip||localStorage.getItem('raices_delivery_zip')||'';
 Object.entries(fields).forEach(([k,id])=>{const e=document.getElementById(id);if(e)e.value=saved[k]||''});
 const zoneFor=z=>zones.find(x=>(x.zips||[]).includes(z)||(x.prefixes||[]).some(p=>z.startsWith(p)));
 function save(){const d={};Object.entries(fields).forEach(([k,id])=>d[k]=document.getElementById(id)?.value.trim()||'');localStorage.setItem('raices_checkout_customer',JSON.stringify(d));return d}
 function eta(){const d=new Date();d.setHours(d.getHours()+Number(rules.estimatedDeliveryMinHours||24));const e=new Date();e.setHours(e.getHours()+Number(rules.estimatedDeliveryMaxHours||48));const f=x=>x.toLocaleDateString('es-US',{weekday:'short',month:'short',day:'numeric'});return `${f(d)} – ${f(e)}`}
 function render(){const data=save(),zip=zipNorm(data.zip),zone=zip.length===5?zoneFor(zip):null,subtotal=Number(summary.subtotal||0),freeAt=Number(rules.freeDeliveryThreshold||0),qualifies=freeAt>0&&subtotal>=freeAt,delivery=zone&&items.length?(qualifies?0:Number(zone.fee||0)):0;
  previewSubtotal.textContent=money(subtotal);previewDelivery.textContent=zone?(qualifies?'Gratis':money(delivery)):'—';previewTotal.textContent=money(subtotal+delivery);checkoutEta.textContent=items.length?`${eta()} · normalmente dentro de 24–48 horas.`:'Agrega productos para calcular la entrega.';
  const left=Math.max(0,freeAt-subtotal);freeDeliveryProgress.textContent=!freeAt?'':qualifies?'Has desbloqueado delivery gratis.':`Agrega ${money(left)} más para delivery gratis.`;
  const msg=checkoutDeliveryMessage;if(!items.length){msg.dataset.state='error';msg.textContent='Tu carrito está vacío.'}else if(zip.length<5){msg.dataset.state='idle';msg.textContent='Ingresa los 5 dígitos del ZIP Code para confirmar cobertura.'}else if(!zone){msg.dataset.state='error';msg.textContent=`El ZIP ${zip} está fuera de la cobertura configurada.`}else{msg.dataset.state='ok';msg.textContent=`Cobertura confirmada: ${zone.name}. ${qualifies?'Delivery gratis.':`Delivery estimado ${money(delivery)}.`}`}
  summary={...summary,delivery:{zip,valid:!!zone,zone:zone?.name||'',cost:delivery},deliveryCost:delivery,total:subtotal+delivery,customer:data,estimatedDelivery:eta()};localStorage.setItem('raices_cart_summary',JSON.stringify(summary));
 }
 Object.values(fields).forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',()=>{if(id==='checkoutZip')e.value=zipNorm(e.value);render()});e.addEventListener('blur',render)}});render();
})();