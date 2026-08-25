(function(){
  function initialize(){

  const catalog = window.RAICES_CATALOG || {};
  const products = catalog.products || window.RAICES_PRODUCTS || [];
  const categories = catalog.categories || window.RAICES_CATEGORIES || {};
  const collections = catalog.collections || window.RAICES_COLLECTIONS || {};
  const categoryDoors = document.getElementById("categoryDoors");
  const categoryFilters = document.getElementById("categoryFilters");
  const collectionSelect = document.getElementById("collectionSelect");
  const productGrid = document.getElementById("productGrid");
  const activeEyebrow = document.getElementById("activeEyebrow");
  const activeTitle = document.getElementById("activeTitle");
  const activeDescription = document.getElementById("activeDescription");
  const productModal = document.getElementById("productModal");
  const productModalBackdrop = document.getElementById("productModalBackdrop");
  const productModalClose = document.getElementById("productModalClose");
  const productModalContent = document.getElementById("productModalContent");

  const cartDrawer = document.getElementById("cartDrawer");
  const cartBackdrop = document.getElementById("cartBackdrop");
  const openCart = document.getElementById("openCart");
  const closeCart = document.getElementById("closeCart");
  const cartItems = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");
  const cartSubtotal = document.getElementById("cartSubtotal");
  const cartDelivery = document.getElementById("cartDelivery");
  const cartDeliverySummary = document.getElementById("cartDeliverySummary");
  const cartTotal = document.getElementById("cartTotal");
  const deliveryZip = document.getElementById("deliveryZip");
  const applyDeliveryZip = document.getElementById("applyDeliveryZip");
  const deliveryMessage = document.getElementById("deliveryMessage");
  const cartStatus = document.getElementById("cartStatus");

  let activeCategory = "All";
  let activeCollection = "All";
  let cart = loadCart();
  let cartSyncTimer = null;
  let cartSyncBusy = false;
  let cartSyncUserId = null;
  let cartRealtimeChannel = null;
  let suppressRemoteCartWrite = false;
  let pendingOrderCheckRunning = false;

  const cartUpdatedAt=()=>Number(localStorage.getItem("raices_cart_updated_at")||0);
  const cartOwner=()=>String(localStorage.getItem("raices_cart_owner")||"");
  const cartKey=item=>cartItemKey(String(item?.sku||""),String(item?.variant||""));
  function sanitizeCart(input){
    if(!Array.isArray(input))return[];
    const map=new Map();
    input.forEach(raw=>{
      const sku=String(raw?.sku||"").trim();
      if(!sku)return;
      const variant=String(raw?.variant||"").trim();
      const qty=Math.max(1,Math.min(99,Math.floor(Number(raw?.qty||1))));
      const key=cartItemKey(sku,variant);
      const previous=map.get(key);
      map.set(key,{sku,variant,qty:previous?Math.max(previous.qty,qty):qty});
    });
    return [...map.values()];
  }
  function mergeCarts(localItems,remoteItems){
    return sanitizeCart([...(Array.isArray(remoteItems)?remoteItems:[]),...(Array.isArray(localItems)?localItems:[])]);
  }
  function setLocalCart(items,{owner=null,updatedAt=Date.now(),render=true}={}){
    cart=sanitizeCart(items);
    localStorage.setItem("raices_cart",JSON.stringify(cart));
    localStorage.setItem("raices_cart_updated_at",String(Number(updatedAt)||Date.now()));
    if(owner)localStorage.setItem("raices_cart_owner",owner);
    else localStorage.removeItem("raices_cart_owner");
    if(render)renderCart();
  }
  async function currentCartUser(){
    if(!window.raicesSupabase)return null;
    try{
      const {data}=await window.raicesSupabase.auth.getUser();
      return data?.user||null;
    }catch{return null}
  }
  async function writeRemoteCart(userId,items){
    if(!window.raicesSupabase||!userId)return;
    const now=new Date().toISOString();
    const {error}=await window.raicesSupabase.from("user_carts").upsert({
      user_id:userId,cart:sanitizeCart(items),updated_at:now
    },{onConflict:"user_id"});
    if(error)throw error;
    localStorage.setItem("raices_cart_owner",userId);
    localStorage.setItem("raices_cart_updated_at",String(Date.parse(now)));
  }
  function scheduleRemoteCartWrite(){
    if(suppressRemoteCartWrite)return;
    clearTimeout(cartSyncTimer);
    cartSyncTimer=setTimeout(async()=>{
      const user=await currentCartUser();
      if(!user)return;
      try{await writeRemoteCart(user.id,cart)}
      catch(error){console.warn("[cart-sync] remote save failed",error)}
    },220);
  }
  async function syncCartForUser(user,{reason="refresh"}={}){
    if(!window.raicesSupabase||!user?.id||cartSyncBusy)return;
    cartSyncBusy=true;
    try{
      const {data,error}=await window.raicesSupabase.from("user_carts").select("cart,updated_at").eq("user_id",user.id).maybeSingle();
      if(error)throw error;
      const localItems=sanitizeCart(loadCart());
      const remoteItems=sanitizeCart(data?.cart||[]);
      const remoteTime=data?.updated_at?Date.parse(data.updated_at):0;
      const localTime=cartUpdatedAt();
      const owner=cartOwner();

      let next;
      let shouldWrite=false;
      if(!data){
        next=localItems;
        shouldWrite=true;
      }else if(owner!==user.id && localItems.length){
        // First login on this device: preserve the guest/local selections without
        // doubling quantities already present in the account cart.
        next=mergeCarts(localItems,remoteItems);
        shouldWrite=JSON.stringify(next)!==JSON.stringify(remoteItems);
      }else if(localTime>remoteTime+1000){
        next=localItems;
        shouldWrite=true;
      }else{
        next=remoteItems;
      }

      suppressRemoteCartWrite=true;
      setLocalCart(next,{owner:user.id,updatedAt:Math.max(remoteTime,localTime,Date.now()),render:true});
      suppressRemoteCartWrite=false;
      if(shouldWrite)await writeRemoteCart(user.id,next);
      cartSyncUserId=user.id;
      console.info("[cart-sync] synchronized",{reason,userId:user.id.slice(0,8),items:next.length});
    }catch(error){
      suppressRemoteCartWrite=false;
      console.warn("[cart-sync] synchronization failed",error);
    }finally{cartSyncBusy=false}
  }
  function subscribeCartRealtime(user){
    if(!window.raicesSupabase||!user?.id)return;
    if(cartRealtimeChannel){window.raicesSupabase.removeChannel(cartRealtimeChannel);cartRealtimeChannel=null}
    cartRealtimeChannel=window.raicesSupabase.channel(`user-cart-${user.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"user_carts",filter:`user_id=eq.${user.id}`},()=>{
        setTimeout(()=>syncCartForUser(user,{reason:"realtime"}),50);
      }).subscribe();
  }
  async function initializeCartSync(){
    const user=await currentCartUser();
    if(user){
      await syncCartForUser(user,{reason:"initial"});
      subscribeCartRealtime(user);
    }
  }
  async function clearRemoteCart(){
    const user=await currentCartUser();
    if(!user)return;
    try{await writeRemoteCart(user.id,[])}catch(error){console.warn("[cart-sync] remote clear failed",error)}
  }

  function readPendingOrder(){
    try{return JSON.parse(sessionStorage.getItem('raices_pending_order')||localStorage.getItem('raices_pending_order')||'{}')}catch{return {}}
  }
  function clearPaidCart(){
    localStorage.removeItem('raices_cart');
    localStorage.removeItem('raices_cart_summary');
    localStorage.removeItem('raices_pending_order');
    localStorage.setItem('raices_cart_updated_at',String(Date.now()));
    sessionStorage.removeItem('raices_pending_order');
    cart=[];
    clearRemoteCart();
    window.dispatchEvent(new CustomEvent('raices:cart-cleared'));
    renderCart();
  }
  async function reconcilePendingPaidOrder(){
    const pending=readPendingOrder();
    if(!pending?.id||pendingOrderCheckRunning)return;
    pendingOrderCheckRunning=true;
    try{
      const response=await fetch('/.netlify/functions/order-status?id='+encodeURIComponent(pending.id),{cache:'no-store'});
      const order=await response.json();
      const paid=String(order.payment_status||'').toLowerCase()==='completed'||String(order.status||'').toLowerCase()==='paid';
      if(response.ok&&paid){
        console.log('[cart] paid_order_confirmed',{orderId:pending.id,orderNumber:order.order_number});
        clearPaidCart();
      }
    }catch(error){console.error('[cart] pending_order_check_failed',{orderId:pending.id,error})}
    finally{pendingOrderCheckRunning=false}
  }
  function favoriteSkus(){ try{return JSON.parse(localStorage.getItem("raices_favorites")||"[]");}catch{return [];} }
  function isFavorite(sku){ return favoriteSkus().includes(sku); }
  function toggleFavorite(sku){ const list=favoriteSkus();const next=list.includes(sku)?list.filter(x=>x!==sku):[...list,sku];localStorage.setItem("raices_favorites",JSON.stringify(next));document.querySelectorAll(`[data-favorite="${sku}"]`).forEach(b=>{b.classList.toggle("active",next.includes(sku));b.setAttribute("aria-pressed",String(next.includes(sku)));b.textContent=next.includes(sku)?"♥":"♡";});window.dispatchEvent(new CustomEvent("raices:favoritesChanged",{detail:{favorites:next}})); }

  function t(key){ return window.raicesT ? window.raicesT(key) : key; }
  function currentLang(){ return window.raicesLang || localStorage.getItem('raices_lang') || 'es'; }
  function categoryLabel(cat){
    if(cat === 'All') return t('all_filter');
    const item = categories[cat] || {};
    return currentLang() === 'es' ? (item.spanish || item.title || cat) : (item.title || cat);
  }

  function localizedCategoryText(cat, field){
    const item = categories[cat] || {};
    if(currentLang()==='en' && item[field + '_en']) return item[field + '_en'];
    return item[field] || '';
  }

  function productDescription(product){
    return product.longDescription || product.description || '';
  }

  function productBenefit(product){
    return product.benefits && product.benefits[0] ? product.benefits[0] : (currentLang()==='es' ? 'Ingredientes reales' : 'Created with intention');
  }

  function productConservation(product){
    return product.conservation || (currentLang()==='es' ? 'Conservación según etiqueta' : 'Store according to label instructions.');
  }

  function productPreparation(product){
    return product.preparation || (currentLang()==='es' ? 'Listo para disfrutar' : 'Ready to enjoy.');
  }

  function money(value){
    return "$" + Number(value || 0).toFixed(2);
  }

  function isProductAvailable(product){
    return !!product && product.available !== false && !product.soldOut;
  }

  function maxProductQty(product){
    if(!product) return 0;
    const stock = product.stock;
    if(stock === null || stock === undefined || stock === '') return Infinity;
    return Math.max(0, Number(stock) || 0);
  }

  function showCartStatus(message, state='info'){
    if(!cartStatus || !message) return;
    cartStatus.hidden = false;
    cartStatus.dataset.state = state;
    cartStatus.textContent = message;
    clearTimeout(showCartStatus.timer);
    showCartStatus.timer = setTimeout(()=>{ cartStatus.hidden = true; }, 6500);
  }

  function soldOutAction(product, context){
    const extraClass = context === 'modal' ? ' sold-out-modal-btn' : '';
    return `<button class="btn sold-out-notify-btn${extraClass}" type="button" data-notify-product="${product.sku}">${t('notify_product')}</button>`;
  }

  function normalizeZip(value){
    return String(value || '').replace(/\D/g,'').slice(0,5);
  }

  let deliveryZones = [];
  let deliveryConfigReady = false;
  let freeDeliveryEnabled = true;
  let freeDeliveryActive = true;
  let freeDeliveryThreshold = Number(window.RAICES_STORE_CONFIG?.ORDER_RULES?.freeDeliveryThreshold ?? 100);
  let freeDeliveryStartDate = "";
  let freeDeliveryEndDate = "";

  function normalizeDeliveryZones(zones){
    const list=value=>Array.isArray(value)?value.flatMap(list):String(value||'').split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean);
    return (Array.isArray(zones) ? zones : []).map(zone => {
      const coverage=[...list(zone?.zips ?? zone?.zip_codes ?? zone?.zipCodes),...list(zone?.coverage)];
      const zips=coverage.filter(v=>!String(v).endsWith('*')).map(normalizeZip).filter(v=>v.length===5);
      const prefix=[...coverage.filter(v=>String(v).endsWith('*')).map(v=>String(v).replace(/\D/g,'').slice(0,5)),...list(zone?.prefixes ?? zone?.prefix).map(v=>String(v).replace(/\D/g,'').slice(0,5))].filter(Boolean);
      return {name:String(zone?.name||zone?.label||'').trim(),cost:Number(zone?.fee ?? zone?.cost ?? zone?.price ?? 0),zips:[...new Set(zips)],prefix:[...new Set(prefix)]};
    }).filter(zone => zone.name && (zone.zips.length || zone.prefix.length));
  }

  async function loadDeliveryConfig(){
    try{
      const res = await fetch('/.netlify/functions/delivery-config', { cache:'no-store' });
      const body = await res.json().catch(()=>({}));
      if(!res.ok || !Array.isArray(body.zones)) throw new Error(body.error || 'DELIVERY_CONFIG_UNAVAILABLE');
      deliveryZones = normalizeDeliveryZones(body.zones);
      freeDeliveryEnabled = body.freeDeliveryEnabled !== false;
      freeDeliveryActive = body.freeDeliveryActive !== false;
      freeDeliveryStartDate = String(body.freeDeliveryStartDate || "");
      freeDeliveryEndDate = String(body.freeDeliveryEndDate || "");
      const remoteThreshold = Number(body.freeDeliveryThreshold);
      if(Number.isFinite(remoteThreshold) && remoteThreshold >= 0) freeDeliveryThreshold = remoteThreshold;
      deliveryConfigReady = true;
      window.RAICES_DELIVERY_ZONES = deliveryZones;
      window.RAICES_FREE_DELIVERY = { enabled: freeDeliveryEnabled, active: freeDeliveryActive, threshold: freeDeliveryThreshold, startDate: freeDeliveryStartDate, endDate: freeDeliveryEndDate };
      if(getDeliveryZip()) buildDeliveryState(getDeliveryZip());
      renderCart();
    }catch(err){
      console.error('Raíces delivery configuration error', err);
      deliveryZones = [];
      deliveryConfigReady = false;
      localStorage.removeItem('raices_delivery_state');
      renderCart();
      showCartStatus(currentLang()==='es' ? 'No se pudo cargar la cobertura de delivery. Intenta de nuevo en unos segundos.' : 'Delivery coverage could not be loaded. Please try again in a few seconds.', 'error');
    }
  }

  function buildDeliveryState(zip){
    const clean = normalizeZip(zip);
    const zone = findDeliveryZone(clean);
    const state = {
      zip: clean,
      valid: clean.length === 5 && !!zone,
      zone: zone ? zone.name : '',
      cost: zone ? Number(zone.cost || 0) : 0,
      unsupported: clean.length === 5 && !zone
    };
    localStorage.setItem('raices_delivery_state', JSON.stringify(state));
    return state;
  }

  function getDeliveryState(){
    return buildDeliveryState(getDeliveryZip());
  }

  function findDeliveryZone(zip){
    const clean = normalizeZip(zip);
    if(clean.length !== 5) return null;
    return deliveryZones.find(zone => (zone.zips && zone.zips.includes(clean)) || (zone.prefix && zone.prefix.some(prefix => clean.startsWith(prefix)))) || null;
  }

  function getDeliveryZip(){
    return normalizeZip(localStorage.getItem('raices_delivery_zip') || '');
  }

  function setDeliveryZip(zip){
    const clean = normalizeZip(zip);
    if(clean) localStorage.setItem('raices_delivery_zip', clean);
    else {
      localStorage.removeItem('raices_delivery_zip');
      localStorage.removeItem('raices_delivery_state');
    }
    if(clean) buildDeliveryState(clean);
    return clean;
  }

  function deliveryText(zone){
    if(!zone) return currentLang()==='es' ? 'Ingresa tu ZIP Code para calcular el delivery.' : 'Enter your ZIP Code to calculate delivery.';
    return currentLang()==='es' ? `${zone.name}: delivery ${money(zone.cost)}` : `${zone.name}: delivery ${money(zone.cost)}`;
  }

  function unsupportedDeliveryText(zip){
    return currentLang()==='es'
      ? `El ZIP ${zip} está fuera de nuestra zona de entrega. Contáctanos por WhatsApp para verificar disponibilidad.`
      : `ZIP ${zip} is outside our delivery area. Contact us on WhatsApp to verify availability.`;
  }


  function deliveryPromptText(zip, zone, hasItems){
    if(!deliveryConfigReady) return currentLang()==='es' ? 'Cargando cobertura de delivery…' : 'Loading delivery coverage…';
    if(zip.length === 5 && zone){
      return currentLang()==='es'
        ? `${zone.name}: se agregará ${money(zone.cost)} de delivery al total${hasItems ? '.' : '. Agrega productos para ver el total.'}`
        : `${zone.name}: ${money(zone.cost)} delivery will be added to the total${hasItems ? '.' : '. Add products to see the total.'}`;
    }
    if(zip.length === 5 && !zone){
      return unsupportedDeliveryText(zip);
    }
    if(zip.length > 0 && zip.length < 5){
      return currentLang()==='es' ? 'Escribe los 5 dígitos del ZIP Code.' : 'Enter the 5 digits of the ZIP Code.';
    }
    return currentLang()==='es' ? 'Ingresa tu ZIP Code para calcular el delivery.' : 'Enter your ZIP Code to calculate delivery.';
  }

  function updateDeliveryUI(zip, zone, itemCount){
    if(!deliveryMessage) return;
    const hasItems = itemCount > 0;
    if(zip.length === 5 && zone){
      deliveryMessage.dataset.state = 'ok';
    } else if(zip.length === 5 && !zone){
      deliveryMessage.dataset.state = 'error';
    } else {
      deliveryMessage.dataset.state = 'idle';
    }
    deliveryMessage.textContent = deliveryPromptText(zip, zone, hasItems);
  }

  function scrollToShopStart(){
    const target = document.getElementById('shopResults');
    if(!target) return;
    const header = document.querySelector('.site-header');
    const headerHeight = header ? header.offsetHeight : 0;
    const extraGap = 18;
    const top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - extraGap;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function translateUnit(unit){
    if(!unit) return '';
    if(currentLang() === 'es') return unit;
    const map = {
      'Paquete':'Pack',
      'Bolsa':'Bag',
      'Unidad':'Unit',
      'Digital':'Digital',
      'Lata':'Tin',
      'Caja':'Box',
      'Pack':'Pack'
    };
    return map[unit] || unit;
  }

  function translateSubcategory(sub){
    if(!sub) return '';
    if(currentLang() === 'es') return sub;
    const map = {
      'Arepas':'Arepas',
      'Empanadas':'Empanadas',
      'Proteínas':'Proteins',
      'Herbal':'Herbal',
      'Postres':'Desserts',
      'Home':'Home',
      'Guías':'Guides'
    };
    return map[sub] || sub;
  }


  function deliveryI18n(key){
    const es = {
      delivery_details_title:'Datos de entrega', delivery_required_note:'Obligatorio para continuar',
      field_name:'Nombre', field_phone:'Teléfono', field_address:'Dirección', field_apt:'Apt / Suite', field_city:'Ciudad', field_notes:'Instrucciones de entrega',
      details_prompt:'Completa tus datos de entrega para continuar.', details_ok:'Datos de entrega guardados.', details_missing:'Faltan datos de entrega obligatorios.',
      name_placeholder:'Nombre y apellido', address_placeholder:'Street address', apt_placeholder:'Opcional', city_placeholder:'Katy', notes_placeholder:'Gate code, dejar en la puerta, etc.'
    };
    const en = {
      delivery_details_title:'Delivery details', delivery_required_note:'Required to continue',
      field_name:'Name', field_phone:'Phone', field_address:'Address', field_apt:'Apt / Suite', field_city:'City', field_notes:'Delivery instructions',
      details_prompt:'Complete your delivery details to continue.', details_ok:'Delivery details saved.', details_missing:'Required delivery details are missing.',
      name_placeholder:'Full name', address_placeholder:'Street address', apt_placeholder:'Optional', city_placeholder:'Katy', notes_placeholder:'Gate code, leave at door, etc.'
    };
    return (currentLang()==='es' ? es : en)[key] || key;
  }

  function loadDeliveryInfo(){
    try { return JSON.parse(localStorage.getItem('raices_delivery_info') || '{}') || {}; }
    catch(e){ return {}; }
  }

  function unitPiecesLabel(count){
    if(!count) return '';
    return currentLang() === 'es' ? `${count} uds` : `${count} pcs`;
  }

  function loadCart(){
    try { return JSON.parse(localStorage.getItem("raices_cart") || "[]"); }
    catch(e){ return []; }
  }

  function saveCart(){
    cart=sanitizeCart(cart);
    localStorage.setItem("raices_cart", JSON.stringify(cart));
    localStorage.setItem("raices_cart_updated_at",String(Date.now()));
    renderCart();
    scheduleRemoteCartWrite();
  }

  function renderDoors(){
    if(!categoryDoors) return;
    const order = ["Kitchen","Herbal","Desserts","Home","Wellness"].filter(cat => categories[cat]?.cmsEnabled !== false);
    categoryDoors.innerHTML = order.map(cat => {
      const item = categories[cat];
      return `<a class="door-card" href="#shop" data-category-door="${cat}">
        <span class="door-bg"><img class="door-bg-img" src="${item.image}" alt="" loading="lazy" decoding="async"></span>
        <span class="door-content">
          <span class="eyebrow">${categoryLabel(cat)}</span>
          <h3>${currentLang()==='es' ? (item.spanish || item.title) : item.title}</h3>
          <p>${localizedCategoryText(cat, 'tagline')}</p>
        </span>
      </a>`;
    }).join("");
    categoryDoors.querySelectorAll("[data-category-door]").forEach(card => {
      card.addEventListener("click", function(e){
        e.preventDefault();
        activeCategory = this.dataset.categoryDoor;
        activeCollection = "All";
        renderFilters();
        renderProducts();
  const requestedProductSlug = new URLSearchParams(window.location.search).get('product');
  if(requestedProductSlug){
    const requestedProduct = products.find(item => item.slug === requestedProductSlug);
    if(requestedProduct){ setTimeout(() => openProductModal(requestedProduct.sku), 180); }
  }
        setTimeout(scrollToShopStart, 60);
      });
    });
  }

  window.addEventListener("raices:siteContentUpdated", function(){ renderDoors(); renderFilters(); });

  function renderFilters(){
    if(!categoryFilters) return;
    const cats = ["All",...(["Kitchen","Herbal","Desserts","Home","Wellness"].filter(cat => categories[cat]?.cmsEnabled !== false))];
    categoryFilters.innerHTML = cats.map(cat => {
      const label = categoryLabel(cat);
      return `<button class="filter-btn ${activeCategory===cat ? "active":""}" data-cat="${cat}">${label}</button>`;
    }).join("");
    categoryFilters.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", function(){
        activeCategory = this.dataset.cat;
        activeCollection = "All";
        renderFilters();
        renderProducts();
        setTimeout(scrollToShopStart, 60);
      });
    });
  }

  function renderCollectionSelect(list){
    if(!collectionSelect) return;
    const collectionNames = ["All", ...Array.from(new Set(list.map(p => p.collection)))];
    collectionSelect.innerHTML = collectionNames.map(c => {
      const label = c === 'All' ? t('collection_select_all') : (collections[c]?.title || c);
      return `<option value="${c}" ${activeCollection===c ? "selected":""}>${label}</option>`;
    }).join("");
  }

  if(collectionSelect){
    collectionSelect.addEventListener("change", function(){
      activeCollection = this.value;
      renderProducts();
      setTimeout(scrollToShopStart, 60);
    });
  }

  function productMeta(product){
    const items = [];
    if(product.unit) items.push(translateUnit(product.unit));
    if(product.unitsPerPackage) items.push(unitPiecesLabel(product.unitsPerPackage));
    if(product.netWeight) items.push(product.netWeight);
    return items.filter(Boolean).map(x => `<span class="chip">${x}</span>`).join("");
  }

  function localizedIngredients(product){
    return product.ingredients || (currentLang()==='es' ? 'Ingredientes reales según variedad.' : 'Real ingredients according to variety.');
  }

  function benefitList(product){
    if(Array.isArray(product.benefits) && product.benefits.length) return product.benefits;
    return [currentLang()==='es' ? 'Creado con intención' : 'Created with intention'];
  }

  function relatedProducts(product){
    const pool = products.filter(p => p.sku !== product.sku);
    let related = [];
    if(product.category==='Herbal') related = pool.filter(p => p.category==='Home' || p.category==='Wellness');
    else if(product.category==='Home') related = pool.filter(p => p.category==='Herbal' || p.category==='Wellness');
    else if(product.category==='Kitchen') related = pool.filter(p => p.category==='Desserts' || p.collection===product.collection);
    else if(product.category==='Wellness') related = pool.filter(p => p.category==='Herbal' || p.category==='Home');
    else related = pool.filter(p => p.category==='Kitchen' || p.category==='Herbal');
    return related.slice(0,3);
  }

  function cartItemKey(sku, variant){
    return variant ? `${sku}::${variant}` : sku;
  }

  function variantDisplay(v){
    if(!v) return '';
    if(currentLang()==='es') return v.labelEs || v.name || '';
    return v.labelEn || v.name || '';
  }

  function productBySku(sku){
    const direct=products.find(p=>p.sku===sku);
    if(direct)return direct;
    for(const group of products){
      const child=(group._groupMembers||[]).find(p=>p.sku===sku);
      if(child)return child;
    }
    return null;
  }

  function variantLabel(product){
    if(!product || !Array.isArray(product.variants) || !product.variants.length) return '';
    if(product.slug === 'ritual-box') return currentLang()==='es' ? 'Elige tu té' : 'Choose your tea';
    if(product.slug === 'signature-teapot') return currentLang()==='es' ? 'Elige tu modelo' : 'Choose your model';
    return currentLang()==='es' ? 'Elige una opción' : 'Choose an option';
  }

  function variantIntro(product){
    if(!product || !Array.isArray(product.variants) || !product.variants.length) return '';
    if(product.slug === 'ritual-box'){
      return currentLang()==='es'
        ? 'Tu Ritual Box incluye el té seleccionado, mug Raíces, difusor dorado y tarjeta de preparación.'
        : 'Your Ritual Box includes the selected tea, Raíces mug, golden infuser and preparation card.';
    }
    if(product.slug === 'signature-teapot'){
      return currentLang()==='es'
        ? 'Selecciona el modelo de tetera que prefieres para tu ritual.'
        : 'Select the teapot model you prefer for your ritual.';
    }
    return currentLang()==='es' ? 'Selecciona una opción antes de agregar al carrito.' : 'Select an option before adding to cart.';
  }

  function openProductModal(sku){
    const p = products.find(item => item.sku === sku);
    if(!p || !productModal || !productModalContent) return;
    const benefits = benefitList(p).map(b => `<li>${b}</li>`).join('');
    const related = relatedProducts(p).map(r => `<button class="ritual-card" ${isProductAvailable(r) ? `data-related-add="${r.sku}"` : `data-related-view="${r.sku}"`}><span style="background-image:url('${r.image}')"></span><strong>${r.name}</strong><em>${money(r.price)}${isProductAvailable(r) ? '' : ` · ${t('sold_out')}`}</em></button>`).join('');
    const hasVariants = Array.isArray(p.variants) && p.variants.length;
    const selectedVariant = hasVariants ? variantDisplay(p.variants[0]) : "";
    const selectedVariantSku = hasVariants ? (p.variants[0]?.sku || p.sku) : p.sku;
    const selectedVariantAvailable = hasVariants ? p.variants[0]?.available !== false : isProductAvailable(p);
    const variantBlock = hasVariants ? `
      <div class="variant-box">
        <label>${variantLabel(p)}</label>
        <div class="variant-options">
          ${p.variants.map((v, idx) => `<button type="button" class="variant-option ${idx===0?'active':''}" data-variant="${variantDisplay(v)}" data-variant-sku="${v.sku||p.sku}" data-variant-image="${v.image}" data-variant-price="${Number(v.price??p.price)}" data-variant-available="${v.available===false?'false':'true'}">${variantDisplay(v)}${v.available===false?` · ${t('sold_out')}`:''}</button>`).join('')}
        </div>
        <p>${variantIntro(p)}</p>
      </div>` : '';
    productModalContent.innerHTML = `
      <div class="product-modal-grid">
        <div class="product-modal-image" id="modalProductImage" style="background-image:url('${hasVariants ? (p.variants[0]?.image || p.image) : p.image}')"></div>
        <div class="product-modal-info">
          <p class="eyebrow">${collections[p.collection]?.title || p.collection}</p>
          <h2>${p.name}</h2><a class="modal-product-page-link" href="/products/${p.slug}/">${currentLang()==='es' ? 'Ver página del producto' : 'View product page'} →</a>
          <p class="modal-description">${productDescription(p)}</p>
          ${productTagsHtml(p,{modal:true})}
          <div class="product-meta modal-meta">${productMeta(p)}</div>
          ${variantBlock}
          <div class="modal-price-row"><div><strong id="modalVariantPrice">${money(hasVariants ? (p.variants[0]?.price ?? p.price) : p.price)}</strong><span id="modalVariantSoldOut" class="sold-out-label" style="display:${selectedVariantAvailable?'none':'inline-flex'}">${t('sold_out')}</span></div><div class="modal-buy-controls" id="modalBuyControls" style="display:${selectedVariantAvailable?'flex':'none'}"><div class="modal-qty" aria-label="${currentLang()==='es' ? 'Cantidad' : 'Quantity'}"><button type="button" data-modal-qty="-1" aria-label="${currentLang()==='es' ? 'Reducir cantidad' : 'Decrease quantity'}">−</button><strong id="modalQtyValue">1</strong><button type="button" data-modal-qty="1" aria-label="${currentLang()==='es' ? 'Aumentar cantidad' : 'Increase quantity'}">+</button></div><button class="btn modal-sticky-add" data-modal-add="${selectedVariantSku}" data-quantity="1" ${hasVariants ? `data-selected-variant="${selectedVariant}"` : ''}>${t('add_to_cart')}</button></div></div>
          <div class="modal-sections product-accordion">
            <details open><summary>${t('benefits')}</summary><div><ul>${benefits}</ul></div></details>
            <details><summary>${t('ingredients')}</summary><div><p>${localizedIngredients(p)}</p></div></details>
            <details><summary>${t('conservation')}</summary><div><p>${productConservation(p)}</p></div></details>
            <details><summary>${t('preparation')}</summary><div><p>${productPreparation(p)}</p></div></details>
            <details><summary>${t('ideal_moment')}</summary><div><p>${p.moment || (currentLang()==='es' ? 'Un ritual cotidiano de bienestar.' : 'An everyday wellness ritual.')}</p></div></details>
          </div>
          <div class="ritual-complete"><h3>${t('related')}</h3><div class="ritual-grid">${related}</div></div>
        </div>
      </div>`;
    productModal.classList.add('open');
    productModal.setAttribute('aria-hidden','false');

    const modalImage = productModalContent.querySelector('#modalProductImage');
    const modalAdd = productModalContent.querySelector('[data-modal-add]');
    productModalContent.querySelectorAll('.variant-option').forEach(btn => {
      btn.addEventListener('click', function(){
        productModalContent.querySelectorAll('.variant-option').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        if(modalImage) modalImage.style.backgroundImage = `url('${this.dataset.variantImage}')`;
        if(modalAdd){
          modalAdd.dataset.selectedVariant = this.dataset.variant;
          modalAdd.dataset.modalAdd = this.dataset.variantSku || p.sku;
        }
        const modalVariantPrice=productModalContent.querySelector('#modalVariantPrice');
        const modalVariantSoldOut=productModalContent.querySelector('#modalVariantSoldOut');
        const modalBuyControls=productModalContent.querySelector('#modalBuyControls');
        const available=this.dataset.variantAvailable!=='false';
        if(modalVariantPrice)modalVariantPrice.textContent=money(Number(this.dataset.variantPrice||p.price));
        if(modalVariantSoldOut){
          modalVariantSoldOut.hidden=available;
          modalVariantSoldOut.style.display=available?'none':'inline-flex';
        }
        if(modalBuyControls){
          modalBuyControls.hidden=!available;
          modalBuyControls.style.display=available?'flex':'none';
        }
      });
    });

    let modalQty = 1;
    const modalQtyValue = productModalContent.querySelector('#modalQtyValue');
    productModalContent.querySelectorAll('[data-modal-qty]').forEach(btn => btn.addEventListener('click', function(){
      const max = maxProductQty(p);
      modalQty = Math.max(1, Math.min(Number.isFinite(max) ? max : 99, modalQty + Number(this.dataset.modalQty || 0)));
      if(modalQtyValue) modalQtyValue.textContent = modalQty;
      if(modalAdd) modalAdd.dataset.quantity = modalQty;
    }));
    productModalContent.querySelectorAll('[data-modal-add]').forEach(btn => btn.addEventListener('click', function(){ addToCart(this.dataset.modalAdd, this.dataset.selectedVariant || "", Number(this.dataset.quantity || 1)); }));
    productModalContent.querySelectorAll('[data-notify-product]').forEach(btn => btn.addEventListener('click', function(){ openProductWaitlist(this.dataset.notifyProduct); }));
    productModalContent.querySelectorAll('[data-related-add]').forEach(btn => btn.addEventListener('click', function(){ addToCart(this.dataset.relatedAdd); }));
    productModalContent.querySelectorAll('[data-related-view]').forEach(btn => btn.addEventListener('click', function(){ openProductModal(this.dataset.relatedView); }));
  }

  function closeProductModal(){
    if(!productModal) return;
    productModal.classList.remove('open');
    productModal.setAttribute('aria-hidden','true');
  }


  function escapeProductTag(value){
    return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function productTagsHtml(product,{limit=null,modal=false}={}){
    const tags=Array.isArray(product?.tags)?product.tags.map(x=>String(x||"").trim()).filter(Boolean):[];
    const visible=limit?tags.slice(0,limit):tags;
    if(!visible.length)return "";
    return `<div class="${modal?'product-feature-tags product-feature-tags--modal':'product-feature-tags'}" aria-label="${currentLang()==='es'?'Características del producto':'Product features'}">${visible.map(tag=>`<span>${escapeProductTag(tag)}</span>`).join("")}</div>`;
  }

  function renderProducts(){
    let list = products.slice();
    if(activeCategory !== "All") list = list.filter(p => p.category === activeCategory);
    renderCollectionSelect(list);
    if(activeCollection !== "All") list = list.filter(p => p.collection === activeCollection);

    if(activeCategory === "All"){
      activeEyebrow.textContent = t('store');
      activeTitle.textContent = t('all_collections');
      activeDescription.textContent = t('all_description');
    } else {
      const c = categories[activeCategory];
      activeEyebrow.textContent = categoryLabel(activeCategory);
      activeTitle.textContent = currentLang()==='es' ? (c.spanish || c.title) : c.title;
      activeDescription.textContent = localizedCategoryText(activeCategory, 'description');
    }

    document.querySelectorAll('[data-category-nav]').forEach(a => {
      a.classList.toggle('active', activeCategory !== 'All' && a.dataset.categoryNav === activeCategory);
    });

    if(!productGrid) return;
    productGrid.innerHTML = list.map(p => {
      const isRitualBox = p.slug === 'ritual-box';
      const isConfigurable = Array.isArray(p.variants) && p.variants.length;
      const primaryAction = !isProductAvailable(p)
        ? `<button class="text-product-link" data-view="${p.sku}">${t('view_product')}</button>${soldOutAction(p, 'card')}`
        : isRitualBox
          ? `<button class="btn personalize-btn" data-view="${p.sku}">${currentLang()==='es' ? 'Personalizar Ritual Box' : 'Customize Ritual Box'}</button>`
          : isConfigurable
            ? `<button class="btn personalize-btn" data-view="${p.sku}">${currentLang()==='es' ? 'Elegir opción' : 'Choose option'}</button>`
            : `<button class="text-product-link" data-view="${p.sku}">${p.cardCta || (p.category==='Wellness' ? (currentLang()==='es' ? 'Explorar guía' : 'Explore guide') : t('view_product'))}</button>
             <button class="btn add-btn" data-add="${p.sku}">${t('add')}</button>`;
      return `<article class="product-card-shop ${isRitualBox ? 'is-ritual-box' : ''} ${isProductAvailable(p) ? '' : 'is-sold-out'}">
      <div class="product-media"><img class="product-media-img" src="${p.image}" alt="${p.name}" loading="lazy" decoding="async" style="object-position:${p.imagePosition || 'center'}">
        <span class="product-badge">${isProductAvailable(p) ? (p.badge || (isRitualBox ? (currentLang()==='es' ? 'Personalizable' : 'Customizable') : (p.category==='Wellness' ? (currentLang()==='es' ? 'Guía digital' : 'Digital guide') : translateSubcategory(p.subcategory)))) : t('sold_out')}</span>
        <button type="button" class="product-favorite-btn ${isFavorite(p.sku) ? 'active' : ''}" data-favorite="${p.sku}" aria-pressed="${String(isFavorite(p.sku))}" aria-label="${currentLang()==='es' ? 'Guardar en favoritos' : 'Save to favorites'}">${isFavorite(p.sku) ? '♥' : '♡'}</button>
      </div>
      <div class="product-body">
        <div>
          <p class="eyebrow">${collections[p.collection]?.title || p.collection}</p>
          <h3><a class="product-seo-link" href="/products/${p.slug}/">${p.name}</a></h3>
        </div>
        <p>${p.cardDescription || productDescription(p)}</p>
        ${productTagsHtml(p,{limit:3})}
        <div class="product-meta">${productMeta(p)}</div>
        <div class="product-details">
          <span>🌿 ${productBenefit(p)}</span>
          <span>❄ ${productConservation(p)}</span>
          <span>🔥 ${productPreparation(p)}</span>
        </div>
        <div class="product-bottom premium-actions">
          ${isRitualBox ? '' : `<span class="price">${p.compareAtPrice && p.compareAtPrice > p.price ? `<del class="compare-price">${money(p.compareAtPrice)}</del>` : ''}${money(p.price)}</span>`}
          <div class="action-stack ${isRitualBox ? 'single-action' : ''}">
            ${primaryAction}
          </div>
        </div>
      </div>
    </article>`;
    }).join("");
    productGrid.querySelectorAll("[data-add]").forEach(btn => {
      btn.addEventListener("click", function(){
        addToCart(this.dataset.add);
      });
    });
    productGrid.querySelectorAll("[data-view]").forEach(btn => {
      btn.addEventListener("click", function(){
        openProductModal(this.dataset.view);
      });
    });
    productGrid.querySelectorAll("[data-notify-product]").forEach(btn => {
      btn.addEventListener("click", function(){
        openProductWaitlist(this.dataset.notifyProduct);
      });
    });
  }

  function openCartDrawer(){
    if(cartDrawer){
      cartDrawer.classList.add("open");
      cartDrawer.setAttribute("aria-hidden","false");
    }
    if(cartBackdrop){
      cartBackdrop.classList.add("show");
      cartBackdrop.setAttribute("aria-hidden","false");
    }
    document.body.classList.add("cart-open");
  }

  function closeCartDrawer(){
    if(cartDrawer){
      cartDrawer.classList.remove("open");
      cartDrawer.setAttribute("aria-hidden","true");
    }
    if(cartBackdrop){
      cartBackdrop.classList.remove("show");
      cartBackdrop.setAttribute("aria-hidden","true");
    }
    document.body.classList.remove("cart-open");
  }

  function addToCart(sku, variant, quantity=1){
    const product = productBySku(sku);
    if(!product) return;
    if(!isProductAvailable(product)){
      openProductWaitlist(product.sku);
      return;
    }
    const key = cartItemKey(sku, variant);
    const existing = cart.find(item => cartItemKey(item.sku, item.variant) === key);
    const maxQty = maxProductQty(product);
    const requestedQty = Math.max(1, Number(quantity) || 1);
    if(existing){
      if(existing.qty >= maxQty){
        showCartStatus(currentLang()==='es' ? `Solo hay ${maxQty} unidad(es) disponibles de ${product.name}.` : `Only ${maxQty} unit(s) of ${product.name} are available.`, 'warning');
        return;
      }
      existing.qty = Math.min(existing.qty + requestedQty, maxQty);
    } else cart.push({ sku: product.sku, qty: Math.min(requestedQty, maxQty), variant: variant || "" });
    saveCart();
    if(document.body.classList.contains('app-experience')){
      closeProductModal();
    }
    window.dispatchEvent(new CustomEvent('raices:productAdded',{detail:{product,quantity:requestedQty}}));
  }

  function updateQty(key, delta){
    const item = cart.find(i => cartItemKey(i.sku, i.variant) === key);
    if(!item) return;
    const product = productBySku(item.sku);
    const maxQty = maxProductQty(product);
    if(delta > 0 && item.qty >= maxQty){
      showCartStatus(currentLang()==='es' ? `Has alcanzado el inventario disponible (${maxQty}).` : `You reached the available inventory (${maxQty}).`, 'warning');
      return;
    }
    item.qty = Math.min(item.qty + delta, maxQty);
    if(item.qty <= 0) cart = cart.filter(i => cartItemKey(i.sku, i.variant) !== key);
    saveCart();
  }

  function renderCart(){
    const removedNames = [];
    const validCart = cart.filter(item => {
      const product = productBySku(item.sku);
      const valid = product && isProductAvailable(product) && maxProductQty(product) > 0;
      if(!valid) removedNames.push(product?.name || item.sku);
      return valid;
    }).map(item => {
      const product = productBySku(item.sku);
      return {...item, qty: Math.min(Math.max(1, Number(item.qty)||1), maxProductQty(product))};
    });
    if(removedNames.length || JSON.stringify(validCart) !== JSON.stringify(cart)){
      cart = validCart;
      localStorage.setItem("raices_cart", JSON.stringify(cart));
      localStorage.setItem("raices_cart_updated_at",String(Date.now()));
      scheduleRemoteCartWrite();
      if(removedNames.length) showCartStatus((currentLang()==='es' ? 'Se retiró del carrito por falta de disponibilidad: ' : 'Removed because it is no longer available: ') + removedNames.join(', '), 'warning');
    }
    const enriched = cart.map(item => ({...item, product: productBySku(item.sku)})).filter(i => i.product && isProductAvailable(i.product));
    const count = enriched.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = enriched.reduce((sum, item) => sum + item.qty * Number(item.product.price || 0), 0);
    const isDigitalProduct = product => String(product?.sku || '').toUpperCase().startsWith('RA-LB-') || /producto digital|ebook|pdf/i.test(String(product?.ingredients || '') + ' ' + String(product?.conservation || ''));
    const hasPhysicalItems = enriched.some(item => !isDigitalProduct(item.product));
    const digitalOnly = enriched.length > 0 && !hasPhysicalItems;
    const physicalSubtotal = enriched.filter(item => !isDigitalProduct(item.product)).reduce((sum, item) => sum + item.qty * Number(item.product.price || 0), 0);
    const zip = getDeliveryZip();
    const baseDeliveryState = getDeliveryState();
    const freeAt = freeDeliveryActive ? Number(freeDeliveryThreshold || 0) : -1;
    const physicalQualifies = hasPhysicalItems && freeDeliveryActive && (freeAt === 0 || physicalSubtotal >= freeAt);
    const deliveryState = digitalOnly
      ? { valid:true, zone:'Entrega digital', cost:0, digitalOnly:true }
      : { ...baseDeliveryState, cost: physicalQualifies ? 0 : Number(baseDeliveryState.cost || 0), digitalOnly:false };
    const zone = deliveryState.valid ? { name: deliveryState.zone, cost: deliveryState.cost } : null;
    const deliveryCost = count > 0 && deliveryState.valid ? deliveryState.cost : 0;
    const total = subtotal + deliveryCost;
    const canCheckout = count > 0;
    window.RAICES_CART_SUMMARY = {
      items: enriched.map(item => ({ sku:item.sku, qty:item.qty, variant:item.variant || '', name:item.product.name, price:Number(item.product.price || 0), lineTotal:item.qty * Number(item.product.price || 0) })),
      subtotal,
      delivery: deliveryState,
      deliveryCost,
      total,
      canCheckout
    };
    localStorage.setItem('raices_cart_summary', JSON.stringify(window.RAICES_CART_SUMMARY));
    if(cartCount) cartCount.textContent = count;
    if(cartSubtotal) cartSubtotal.textContent = money(subtotal);
    if(cartDelivery) cartDelivery.textContent = count ? (digitalOnly ? (currentLang()==='es' ? 'No aplica' : 'Not applicable') : (deliveryState.valid ? (deliveryCost===0 ? (currentLang()==='es' ? 'Gratis' : 'Free') : money(deliveryCost)) : '—')) : '—';
    if(cartDeliverySummary) cartDeliverySummary.textContent = digitalOnly ? (currentLang()==='es' ? 'No aplica' : 'Not applicable') : (deliveryState.valid ? (deliveryState.cost===0 ? (currentLang()==='es' ? 'Gratis' : 'Free') : money(deliveryState.cost)) : '—');
    if(cartTotal) cartTotal.textContent = money(total);
    const checkoutBtn = document.getElementById('checkoutSoon');
    if(checkoutBtn){
      const salesMode = window.RAICES_STORE_CONFIG?.STORE_MODE === 'SALES';
      checkoutBtn.classList.toggle('disabled', !canCheckout);
      checkoutBtn.disabled = !canCheckout;
      checkoutBtn.textContent = salesMode
        ? (currentLang()==='es' ? 'Continuar al checkout' : 'Continue to checkout')
        : (currentLang()==='es' ? 'Continuar al checkout' : 'Continue to checkout');
    }
    const cartNote = document.querySelector('.cart-note');
    if(cartNote){
      cartNote.textContent = currentLang()==='es'
        ? 'La dirección completa, impuestos y pago se completan en el checkout. Pagos aún no habilitados.'
        : 'Full address, taxes and payment are completed at checkout. Payments are not enabled yet.';
    }
    if(deliveryZip && document.activeElement !== deliveryZip) deliveryZip.value = zip;
    updateDeliveryUI(zip, deliveryState.valid ? { name: deliveryState.zone, cost: deliveryState.cost } : null, count);

    if(!cartItems) return;
    if(enriched.length === 0){
      cartItems.innerHTML = `<div class="cart-empty-state">
        <div class="cart-empty-icon">🛒</div>
        <h3>${currentLang()==='es' ? 'Tu carrito está vacío' : 'Your cart is empty'}</h3>
        <p>${currentLang()==='es' ? 'Explora las colecciones de Raíces y agrega tus productos favoritos.' : 'Explore Raíces collections and add your favorite products.'}</p>
        <button class="btn cart-continue" type="button">${currentLang()==='es' ? 'Explorar tienda' : 'Explore shop'}</button>
      </div>`;
      const continueBtn = cartItems.querySelector('.cart-continue');
      if(continueBtn) continueBtn.addEventListener('click', function(){ closeCartDrawer(); setTimeout(scrollToShopStart, 120); });
      return;
    }
    cartItems.innerHTML = enriched.map(item => {
      const key = cartItemKey(item.sku, item.variant);
      const variantText = item.variant ? `<span class="cart-variant">${item.variant}</span>` : "";
      const variantImage = item.variant && Array.isArray(item.product.variants) ? (item.product.variants.find(v => variantDisplay(v) === item.variant || v.name === item.variant)?.image || item.product.image) : item.product.image;
      const unit = translateUnit(item.product.unit);
      const stockNote = '';
      return `<div class="cart-item">
      <div class="cart-item-img" style="background-image:url('${variantImage}')"></div>
      <div class="cart-item-main">
        <div class="cart-item-title-row">
          <h4>${item.product.name}</h4>
          <button class="cart-remove" data-remove="${key}" aria-label="${currentLang()==='es' ? 'Eliminar' : 'Remove'}">×</button>
        </div>
        <div class="cart-item-meta">${unit ? `<span>${unit}</span>` : ''}${variantText}${stockNote}</div>
        <div class="cart-item-bottom">
          <div class="qty-controls">
            <button data-qty="${key}" data-delta="-1" aria-label="${currentLang()==='es' ? 'Reducir cantidad' : 'Decrease quantity'}">−</button>
            <strong>${item.qty}</strong>
            <button data-qty="${key}" data-delta="1" ${item.qty >= maxProductQty(item.product) ? 'disabled' : ''} aria-label="${currentLang()==='es' ? 'Aumentar cantidad' : 'Increase quantity'}">+</button>
          </div>
          <strong class="cart-item-total">${money(item.qty * Number(item.product.price || 0))}</strong>
        </div>
      </div>
    </div>`;
    }).join("");
    cartItems.querySelectorAll("[data-qty]").forEach(btn => {
      btn.addEventListener("click", function(){
        updateQty(this.dataset.qty, Number(this.dataset.delta));
      });
    });
    cartItems.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", function(){
        cart = cart.filter(i => cartItemKey(i.sku, i.variant) !== this.dataset.remove);
        saveCart();
      });
    });
  }

  if(applyDeliveryZip) applyDeliveryZip.addEventListener("click", function(e){
    e.preventDefault();
    const zip = setDeliveryZip(deliveryZip ? deliveryZip.value : '');
    if(deliveryZip) deliveryZip.value = zip;
    renderCart();
  });
  if(deliveryZip){
    deliveryZip.value = getDeliveryZip();
    deliveryZip.addEventListener("input", function(){
      this.value = normalizeZip(this.value);
      if(this.value.length === 5){ setDeliveryZip(this.value); renderCart(); }
      else updateDeliveryUI(this.value, null, cart.length);
    });
    deliveryZip.addEventListener("keydown", function(e){
      if(e.key === 'Enter'){ e.preventDefault(); setDeliveryZip(this.value); renderCart(); }
    });
    deliveryZip.addEventListener("blur", function(){ setDeliveryZip(this.value); renderCart(); });
  }


  if(openCart) openCart.addEventListener("click", function(e){ e.preventDefault(); openCartDrawer(); });
  if(closeCart) closeCart.addEventListener("click", closeCartDrawer);
  if(cartBackdrop) cartBackdrop.addEventListener("click", closeCartDrawer);
  if(productModalClose) productModalClose.addEventListener("click", closeProductModal);
  if(productModalBackdrop) productModalBackdrop.addEventListener("click", closeProductModal);
  document.addEventListener("keydown", function(e){ if(e.key === 'Escape'){ closeProductModal(); closeCartDrawer(); } });

  document.querySelectorAll('[data-category-nav]').forEach(link => {
    link.addEventListener('click', function(e){
      e.preventDefault();
      activeCategory = this.dataset.categoryNav;
      activeCollection = 'All';
      renderFilters();
      renderProducts();
      setTimeout(scrollToShopStart, 60);
      const drawer = document.getElementById('drawer');
      const backdrop = document.getElementById('backdrop');
      if(drawer) drawer.classList.remove('open');
      if(backdrop) backdrop.classList.remove('show');
    });
  });



  const waitlistModal = document.getElementById('waitlistModal');
  const waitlistBackdrop = document.getElementById('waitlistBackdrop');
  const waitlistClose = document.getElementById('waitlistClose');
  const waitlistForm = document.getElementById('waitlistCheckoutForm');
  const waitlistEmail = document.getElementById('waitlistEmail');
  const waitlistName = document.getElementById('waitlistName');
  const waitlistConsent = document.getElementById('waitlistConsent');
  const waitlistMessage = document.getElementById('waitlistMessage');
  let waitlistProduct = null;

  function openProductWaitlist(sku){
    waitlistProduct = products.find(product => product.sku === sku) || null;
    window.RAICES_WAITLIST_PRODUCT = waitlistProduct;
    if(waitlistProduct){
      const title = waitlistModal ? waitlistModal.querySelector('h2') : null;
      const text = waitlistModal ? waitlistModal.querySelector('.waitlist-copy, [data-i18n="waitlist_checkout_text"]') : null;
      if(title) title.textContent = `${t('notify_product_title')}: ${waitlistProduct.name}`;
      if(text) text.textContent = t('notify_product_text');
    }
    openWaitlistModal();
  }

  function openWaitlistModal(){
    if(waitlistEmail){
      const savedEmail = (localStorage.getItem('raices_waitlist_email') || '').trim();
      if(savedEmail) waitlistEmail.value = savedEmail;
    }
    if(waitlistModal){
      waitlistModal.classList.add('open');
      waitlistModal.setAttribute('aria-hidden','false');
      setTimeout(()=>{ if(waitlistEmail) waitlistEmail.focus(); }, 80);
    }
  }
  function closeWaitlistModal(){
    if(waitlistModal){
      waitlistModal.classList.remove('open');
      waitlistModal.setAttribute('aria-hidden','true');
    }
  }
  const checkoutWaitBtn = document.getElementById('checkoutSoon');
  if(checkoutWaitBtn) checkoutWaitBtn.addEventListener('click', function(e){
    e.preventDefault();
    const config = window.RAICES_STORE_CONFIG || {};
    const summary = window.RAICES_CART_SUMMARY || {};
    if(!summary.canCheckout) return;
    window.location.href = config.CHECKOUT_PREVIEW_URL || 'checkout-preview.html';
  });
  if(waitlistBackdrop) waitlistBackdrop.addEventListener('click', closeWaitlistModal);
  if(waitlistClose) waitlistClose.addEventListener('click', closeWaitlistModal);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeWaitlistModal(); });

  window.addEventListener('raices:languageChanged', function(){
    window.RAICES_RELOCALIZE_PRODUCTS?.();
    renderDoors();
    renderFilters();
    renderProducts();
    renderCart();
  });

  document.addEventListener("click", function(e){
    const button = e.target.closest("[data-favorite]");
    if(!button) return;
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(button.dataset.favorite);
  });

  renderDoors();
  renderFilters();
  renderProducts();
  renderCart();

  // Returning from checkout to review the cart should open the cart drawer once.
  const returnParams = new URLSearchParams(window.location.search);
  if(returnParams.get('cart') === 'open'){
    setTimeout(openCartDrawer, 80);
    returnParams.delete('cart');
    const cleanQuery = returnParams.toString();
    const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || '#shop'}`;
    window.history.replaceState({}, '', cleanUrl);
  }

  loadDeliveryConfig();
  reconcilePendingPaidOrder();
  initializeCartSync();
  window.addEventListener("pageshow",async()=>{
    reconcilePendingPaidOrder();
    const user=await currentCartUser();
    if(user)syncCartForUser(user,{reason:"pageshow"});
  });
  window.addEventListener("focus",async()=>{
    const user=await currentCartUser();
    if(user)syncCartForUser(user,{reason:"focus"});
  });
  document.addEventListener("visibilitychange",async()=>{
    if(document.visibilityState==="visible"){
      reconcilePendingPaidOrder();
      const user=await currentCartUser();
      if(user)syncCartForUser(user,{reason:"visible"});
    }
  });
  window.addEventListener("raices:authChanged",async(event)=>{
    const user=event.detail?.user||null;
    if(user){
      await syncCartForUser(user,{reason:"auth"});
      subscribeCartRealtime(user);
    }else{
      if(cartRealtimeChannel){window.raicesSupabase?.removeChannel(cartRealtimeChannel);cartRealtimeChannel=null}
      cartSyncUserId=null;
      localStorage.removeItem("raices_cart_owner");
    }
  });

  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initialize, { once:true });
  } else {
    initialize();
  }
})();
