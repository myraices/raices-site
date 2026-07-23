(function(){
 const params=new URLSearchParams(location.search),id=params.get('order');
 let pending={};try{pending=JSON.parse(sessionStorage.getItem('raices_pending_order')||'{}')}catch(e){}
 const number=document.getElementById('confirmationNumber'),status=document.getElementById('confirmationStatus'),icon=document.getElementById('confirmationIcon'),eyebrow=document.getElementById('confirmationEyebrow'),title=document.getElementById('confirmationTitle'),text=document.getElementById('confirmationText'),timeline=document.getElementById('paymentTimeline');
 if(pending.orderNumber)number.textContent='#'+pending.orderNumber;
 let attempts=0;
 async function check(){
  attempts++;
  try{
   const r=await fetch('/.netlify/functions/order-status?id='+encodeURIComponent(id||pending.id||''),{cache:'no-store'}),d=await r.json();
   if(r.ok){
    if(d.order_number)number.textContent='#'+d.order_number;
    status.textContent=d.payment_status||d.status||'Pendiente';
    if(String(d.payment_status).toLowerCase()==='completed'||String(d.status).toLowerCase()==='paid'){
     icon.textContent='✓';eyebrow.textContent='Pedido recibido';title.textContent='Gracias por volver a la raíz.';text.textContent='Tu pago fue confirmado y recibimos tu pedido.';timeline.classList.add('done');
     sessionStorage.setItem('raices_confirmed_order',JSON.stringify({orderNumber:d.order_number,paymentStatus:'completed'}));
     localStorage.removeItem('raices_cart');localStorage.removeItem('raices_cart_summary');return;
    }
   }
  }catch(e){console.error(e)}
  if(attempts<12)setTimeout(check,2500);else{text.textContent='Tu compra fue recibida y la confirmación del pago continúa procesándose. Evita repetir el pago.';status.textContent='Confirmación en proceso';}
 }
 if(id||pending.id)check();else{text.textContent='No encontramos la referencia del pedido. Regresa a la tienda o contáctanos para ayudarte.';status.textContent='Referencia no disponible';}
})();
