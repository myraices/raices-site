(function(){
  const mq = window.matchMedia('(max-width:760px)');
  if(!mq.matches||new URLSearchParams(location.search).get('cmsPreview')==='1') return;
  document.body.classList.add('app-experience');

  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let pendingCategory=null;
  let selectedCategory="All";
  const categoryKeys=['Kitchen','Herbal','Desserts','Home','Wellness'];
  const categoryName=cat=>({Kitchen:txt('Cocina','Kitchen'),Herbal:'Herbal',Desserts:txt('Dulces','Desserts'),Home:'Home',Wellness:txt('Guías','Guides')})[cat];
  const configurable=p=>(p.variants||[]).length>0||p.slug==='ritual-box';
  const shortName=p=>String(p.name||'').replace(/\s*\([^)]*(?:pulgadas|inch|porciones|servings)[^)]*\)/gi,'').trim();
  window.RAICES_MOBILE_NAME=p=>escapeHTML(shortName(p));
  window.RAICES_MOBILE_PRESENTATION=p=>{
    const size=String(p.name||'').match(/(\d+(?:\.\d+)?)\s*(?:pulgadas|inch)/i);
    const count=window.RAICES_PACKAGE_LABEL?.(p);
    return count||(size?size[1]+'″ · ':'')+(p.netWeight||p.unitWeight||p.unit||'');
  };
  const money = value => '$' + Number(value || 0).toFixed(2);
  const lang = () => window.raicesLang || localStorage.getItem('raices_lang') || 'es';
  const txt = (es,en) => lang()==='es' ? es : en;
  const icon = name => ({
    home:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>',
    cart:'<svg viewBox="0 0 24 24"><path d="M4 5h2l2 10h9l2-7H7M9 20h.01M17 20h.01"/></svg>',
    orders:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></svg>',
    profile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.6-4.3 3.3-7 8-7s7.4 2.7 8 7"/></svg>',
    blog:'<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></svg>'
  })[name];

  function getProducts(){ return (window.RAICES_CATALOG && window.RAICES_CATALOG.products) || window.RAICES_PRODUCTS || []; }
  function clickExisting(selector){ const el=document.querySelector(selector); if(el){el.click(); return true;} return false; }
  function openProduct(sku){
    const btn=document.querySelector(`[data-view="${CSS.escape(sku)}"]`);
    if(btn){ btn.click(); return; }
    const p=getProducts().find(x=>x.sku===sku); if(p&&p.slug) location.href='/products/'+p.slug+'/';
  }
  function addProduct(sku){
    const btn=document.querySelector(`[data-add="${CSS.escape(sku)}"]`);
    if(btn){ btn.click(); pulseCart(); return; }
    openProduct(sku);
  }
  function chooseCategory(cat){
    selectedCategory=cat;closeSearch();document.body.classList.add('mobile-catalog-active');setActive('shop');
    if(window.RAICES_BROWSE_CATEGORY)window.RAICES_BROWSE_CATEGORY(cat);
    else pendingCategory=cat;
    document.querySelectorAll('[data-mobile-cat]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileCat===cat)));
    requestAnimationFrame(()=>document.getElementById('shopResults')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  function updateHero(){
    const image=document.getElementById('mobileHeroImage');if(!image)return;
    const content=window.RAICES_SITE_CONTENT||{};
    const editorial=content.editorial?.primary_image_url;
    const explicit=!editorial&&content.hero?.image_mobile_url;
    const value=editorial||explicit||categoryImage('Kitchen','/assets/empanadas-signature-board.webp');
    if(image.dataset.original===value)return;
    image.dataset.original=value;
    window.RaicesImages.set(image,value,'(max-width:760px) 100vw, 600px',[480,640,960]);
    image.alt=explicit?(content.hero?.['image_alt_'+lang()]||content.hero?.image_alt_es||txt('Raíces: volver a lo esencial','Raíces: back to our roots')):txt('Alimentos artesanales de Raíces','Handcrafted Raíces foods');
  }
  async function checkDelivery(form){
    const input=form.querySelector('input'),message=form.querySelector('[role="status"]'),button=form.querySelector('button');
    if(!/^\d{5}$/.test(input.value)){message.textContent=txt('Escribe un ZIP de 5 dígitos.','Enter a 5-digit ZIP code.');input.focus();return;}
    button.disabled=true;message.textContent=txt('Consultando cobertura…','Checking delivery…');message.dataset.state='idle';
    try{
      if(!window.RAICES_CHECK_DELIVERY)throw new Error('not-ready');
      const state=await window.RAICES_CHECK_DELIVERY(input.value);
      message.dataset.state=state.valid?'ok':'error';
      message.textContent=state.valid
        ? txt(`Sí, entregamos en ${state.zone}. Tarifa base: ${money(state.cost)}. El total se confirma en el carrito.`,`Yes, we deliver to ${state.zone}. Base fee: ${money(state.cost)}. The cart confirms the final total.`)
        : txt('Tu ZIP no aparece en la cobertura local. Consulta por WhatsApp; las guías digitales no requieren entrega.','Your ZIP is outside our listed local coverage. Ask us on WhatsApp; digital guides need no delivery.');
    }catch{message.textContent=txt('No pudimos consultar la cobertura. Intenta de nuevo en unos momentos.','We could not check delivery. Please try again shortly.');message.dataset.state='error';}
    finally{button.disabled=false;}
  }
  function pulseCart(){ document.querySelector('.app-nav-cart')?.animate([{transform:'scale(1)'},{transform:'scale(1.13)'},{transform:'scale(1)'}],{duration:360}); }
  function categoryImage(cat,fallback){
    const value=window.RAICES_CATEGORIES?.[cat]?.image;
    return value || fallback;
  }
  function updateMobileCategoryImages(){
    document.querySelectorAll('.app-intent[data-cat]').forEach(button=>{
      const cat=button.dataset.cat;
      const fallbacks={
        Kitchen:'/assets/categories/category-kitchen.webp',
        Herbal:'/assets/categories/category-herbal.webp',
        Desserts:'/assets/categories/category-desserts.webp',
        Home:'/assets/categories/category-home.webp',
        Wellness:'/assets/categories/category-wellness.webp'
      };
      const image=categoryImage(cat,fallbacks[cat]||'');
      if(image) window.RaicesImages.background(button,image,480);
    });
  }

  function createShell(){
    const shell=document.createElement('section'); shell.className='app-shell'; shell.id='appHome';
    shell.innerHTML=`
      <section class="mobile-hero" aria-labelledby="mobileHeroTitle">
        <div class="mobile-hero-photo"><img id="mobileHeroImage" src="/assets/empanadas-signature-board.webp" alt="${txt('Alimentos artesanales de Raíces','Handcrafted Raíces foods')}" width="960" height="640" fetchpriority="high" decoding="async"></div>
        <div class="mobile-hero-copy"><p class="eyebrow">${txt('La salud comienza desde la raíz','Health begins at the root')}</p><h1 id="mobileHeroTitle">${txt('Nutre tu cuerpo.<br>Vuelve a tus raíces.','Nourish your body.<br>Return to your roots.')}</h1><p>${txt('Alimentos artesanales y rituales de bienestar para tu día a día.','Handcrafted foods and wellness rituals for everyday life.')}</p><button class="btn" type="button" data-browse>${txt('Comprar ahora','Shop now')} <span aria-hidden="true">↗</span></button></div>
      </section>
      <section class="mobile-delivery" aria-labelledby="mobileDeliveryTitle"><p class="eyebrow">${txt('Cerca de ti','Close to you')}</p><h2 id="mobileDeliveryTitle">${txt('¿Entregamos en tu zona?','Do we deliver to you?')}</h2><p>${txt('Consulta la cobertura local con tu ZIP.','Check local delivery with your ZIP code.')}</p><form id="mobileDeliveryForm" novalidate><label class="sr-only" for="mobileDeliveryZip">ZIP Code</label><div class="mobile-zip-row"><input id="mobileDeliveryZip" name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" pattern="[0-9]{5}" placeholder="ZIP Code"><button type="submit">${txt('Consultar','Check')}</button></div><p role="status" aria-live="polite"></p></form></section>
      <section class="mobile-collections" aria-labelledby="mobileCollectionTitle"><div class="app-section-row"><div><p class="eyebrow">${txt('Una misma raíz','One shared root')}</p><h2 id="mobileCollectionTitle">${txt('Explora nuestras colecciones','Explore our collections')}</h2></div></div><div class="app-intent-grid">${categoryKeys.map(cat=>`<button type="button" class="app-intent" data-cat="${cat}"><span>${categoryName(cat)}<small>${({Kitchen:txt('Arepas, empanadas y proteínas','Arepas, empanadas & proteins'),Herbal:txt('Tés e infusiones','Teas & infusions'),Desserts:txt('Postres para compartir','Desserts to share'),Home:txt('Objetos para tus rituales','Objects for your rituals'),Wellness:txt('Bienestar para aprender','Wellness to discover')})[cat]}</small></span></button>`).join('')}</div></section>
      <section class="mobile-featured" aria-labelledby="mobileFeaturedTitle"><div class="app-section-row"><div><p class="eyebrow">${txt('Elegidos para ti','Selected for you')}</p><h2 id="mobileFeaturedTitle">${txt('Para comenzar','Start here')}</h2></div><button type="button" data-see-all>${txt('Ver todo','View all')} ↗</button></div><div class="app-product-rail" id="appFeatured"><p role="status">${txt('Cargando productos…','Loading products…')}</p></div></section>`;
    const main=document.querySelector('main'); main?.parentNode.insertBefore(shell,main);

    const search=document.createElement('section'); search.className='app-search-screen'; search.id='appSearch';
    search.setAttribute('aria-hidden','true'); search.innerHTML=`<div class="app-search-head"><button class="app-back" type="button" aria-label="${txt('Volver','Back')}">‹</button><label class="app-search-box"><span>⌕</span><input id="appSearchInput" type="search" autocomplete="off" placeholder="${txt('¿Qué estás buscando?','What are you looking for?')}"></label></div><div class="app-search-summary" id="appSearchSummary"></div><div class="app-search-results" id="appSearchResults"></div>`;
    document.body.appendChild(search);

    const nav=document.createElement('nav'); nav.className='app-bottom-nav'; nav.setAttribute('aria-label','App');
    nav.innerHTML=`
      <button type="button" class="app-nav-btn active" data-app-tab="home" aria-current="page">${icon('home')}<span>${txt('Inicio','Home')}</span></button>
      <button type="button" class="app-nav-btn" data-app-tab="shop">${icon('search')}<span>${txt('Tienda','Shop')}</span></button>
      <button type="button" class="app-nav-btn app-nav-cart" data-app-tab="cart">${icon('cart')}<span>${txt('Carrito','Cart')}</span><i class="app-nav-badge" id="appCartCount">0</i></button>
      <button type="button" class="app-nav-btn" data-app-tab="profile">${icon('profile')}<span>${txt('Mi cuenta','My account')}</span></button>`;
    document.body.appendChild(nav);

    shell.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>chooseCategory(b.dataset.cat)));
    shell.querySelectorAll('[data-see-all],[data-browse]').forEach(b=>b.addEventListener('click',()=>chooseCategory('All')));
    const form=shell.querySelector('#mobileDeliveryForm');
    form.querySelector('input').value=localStorage.getItem('raices_delivery_zip')||'';
    form.addEventListener('submit',e=>{e.preventDefault();checkDelivery(form);});
    form.querySelector('input').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,5);});
    updateHero();updateMobileCategoryImages();
    shell.querySelectorAll('.app-search-trigger,[data-search-open]').forEach(b=>b.addEventListener('click',openSearch));
    search.querySelector('.app-back').addEventListener('click',closeSearch);
    search.querySelector('#appSearchInput').addEventListener('input',e=>renderSearch(e.target.value));
    nav.querySelectorAll('[data-app-tab]').forEach(b=>b.addEventListener('click',()=>handleTab(b.dataset.appTab)));
  }

  function handleTab(tab){
    if(tab==='home'){ closeSearch(); document.body.classList.remove('mobile-catalog-active');setActive('home');const input=document.getElementById('mobileDeliveryZip');const zip=localStorage.getItem('raices_delivery_zip')||'';if(input&&input.value!==zip){input.value=zip;document.querySelector('#mobileDeliveryForm [role=status]').textContent='';} window.scrollTo({top:0,behavior:'smooth'}); }
    if(tab==='shop')chooseCategory('All');
    if(tab==='search') openSearch();
    if(tab==='cart'){ document.getElementById('openCart')?.click(); setActive('cart'); }
    if(tab==='blog'){ location.href='/blog'; return; }
    if(tab==='orders'||tab==='profile'){ document.querySelector('.js-auth-open')?.click(); setActive(tab); }
  }
  function setActive(tab){ document.querySelectorAll('.app-nav-btn').forEach(b=>{const active=b.dataset.appTab===tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}); }
  function setPreopeningBannerVisible(visible){
    document.querySelectorAll('.preopening-bar').forEach(bar=>{
      if(visible){
        bar.hidden=false;
        bar.style.removeProperty('display');
        bar.removeAttribute('aria-hidden');
      }else{
        bar.hidden=true;
        bar.style.setProperty('display','none','important');
        bar.setAttribute('aria-hidden','true');
      }
    });
  }
  function openSearch(){
    const screen=document.getElementById('appSearch');
    screen?.classList.add('open');
    screen?.setAttribute('aria-hidden','false');
    document.body.classList.add('app-search-open');
    setPreopeningBannerVisible(false);
    setActive('search');
    renderSearch('');
    requestAnimationFrame(()=>{ if(screen) screen.scrollTop=0; });
    setTimeout(()=>document.getElementById('appSearchInput')?.focus(),60);
  }
  function closeSearch(){
    const screen=document.getElementById('appSearch');
    screen?.classList.remove('open');
    screen?.setAttribute('aria-hidden','true');
    document.body.classList.remove('app-search-open');
    setPreopeningBannerVisible(true);
    setActive(document.body.classList.contains('mobile-catalog-active')?'shop':'home');
  }
  function productCard(p){
    const available=p.available!==false&&!p.soldOut,needsOptions=configurable(p);
    const name=escapeHTML(shortName(p)),sku=escapeHTML(p.sku);
    const presentation=window.RAICES_MOBILE_PRESENTATION(p);
    return `<article class="app-product-card"><button class="mobile-featured-view" type="button" data-app-view="${sku}"><img ${window.RaicesImages.attrs(p.image,'(max-width:760px) 46vw, 320px')} alt="${name}" loading="lazy" decoding="async"><h3>${name}</h3></button><div class="app-product-info"><p class="mobile-presentation">${escapeHTML(presentation)}</p><strong class="app-price">${money(p.price)}</strong>${available?`<button class="app-add" type="button" ${needsOptions?'data-app-view':'data-app-add'}="${sku}">${needsOptions?txt('Elegir opciones','Choose options'):txt('Agregar','Add')}</button>`:`<span>${txt('Agotado','Sold out')}</span>`}</div></article>`;
  }
  function bindCards(root){
    root.querySelectorAll('[data-app-view]').forEach(b=>b.addEventListener('click',e=>{ if(e.target.closest('[data-app-add]')) return; openProduct(b.dataset.appView); }));
    root.querySelectorAll('[data-app-add]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const product=getProducts().find(p=>p.sku===b.dataset.appAdd);if(product&&configurable(product))openProduct(product.sku);else addProduct(b.dataset.appAdd);}));
  }
  function renderFeatured(){
    const root=document.getElementById('appFeatured'); if(!root) return;
    const available=getProducts().filter(p=>p.available!==false&&!p.soldOut);
    const featured=available.filter(p=>p.featured);
    const ps=(featured.length?featured:available).slice(0,4); root.innerHTML=ps.length?ps.map(productCard).join(''):`<p>${txt('No hay productos disponibles en este momento.','No products are available right now.')}</p>`; bindCards(root);
  }
  function miniCard(p){
    const available=p.available!==false&&!p.soldOut;
    return `<article class="app-mini-card" data-search-product="${p.sku}">
      <button class="app-mini-view" type="button" data-app-view="${p.sku}">
        <img ${window.RaicesImages.attrs(p.image,"(max-width:760px) 72vw, 320px")} alt="${p.name}" loading="lazy">
        <div class="app-mini-body"><h3>${p.name}</h3>${window.RAICES_PACKAGE_HTML(p)}<div class="app-mini-actions"><span>${money(p.price)}</span></div></div>
      </button>
      ${available?`<button class="app-mini-add" type="button" data-app-add="${p.sku}" aria-label="${txt('Agregar','Add')} ${p.name}">+</button>`:''}
    </article>`;
  }
  function renderSearch(q){
    const root=document.getElementById('appSearchResults'); if(!root) return;
    const summary=document.getElementById('appSearchSummary');
    const term=String(q||'').trim().toLocaleLowerCase();
    const all=getProducts().filter(Boolean);
    let ps=term ? all.filter(p=>[p.name,p.category,p.subcategory,p.collection,p.description,p.sku].join(' ').toLocaleLowerCase().includes(term)) : all.slice();
    ps.sort((a,b)=>(Number(a.sortOrder||0)-Number(b.sortOrder||0)) || String(a.name||'').localeCompare(String(b.name||''),lang()));
    if(summary){
      summary.textContent=term
        ? txt(`${ps.length} resultado${ps.length===1?'':'s'}`,`${ps.length} result${ps.length===1?'':'s'}`)
        : txt(`Todos los productos · ${ps.length}`,`All products · ${ps.length}`);
    }
    root.innerHTML=ps.length?ps.map(miniCard).join(''):`<div class="app-search-empty">${txt('No encontramos productos con ese nombre.','No products found.')}</div>`;
    bindCards(root);
  }
  function syncCartCount(){ const src=document.getElementById('cartCount'),dst=document.getElementById('appCartCount'); if(src&&dst) dst.textContent=src.textContent||'0'; }
  function watchCart(){ const src=document.getElementById('cartCount'); if(!src)return; syncCartCount(); new MutationObserver(syncCartCount).observe(src,{childList:true,subtree:true,characterData:true}); }

  function init(){
    createShell();
    const headerSearch=document.createElement('button');headerSearch.type='button';headerSearch.className='icon-link mobile-header-search';headerSearch.setAttribute('aria-label',txt('Buscar productos','Search products'));headerSearch.innerHTML=icon('search');headerSearch.addEventListener('click',openSearch);document.querySelector('.nav-icons')?.prepend(headerSearch);
    const chips=document.createElement('nav');chips.className='mobile-category-tabs';chips.setAttribute('aria-label',txt('Colecciones','Collections'));
    const rebuildChips=()=>{chips.innerHTML=['All',...categoryKeys].map(cat=>`<button type="button" data-mobile-cat="${cat}" aria-pressed="${cat===selectedCategory}">${cat==='All'?txt('Todo','All'):categoryName(cat)}</button>`).join('');chips.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>chooseCategory(b.dataset.mobileCat)));};rebuildChips();document.querySelector('#shopResults .shop-main')?.prepend(chips);
    document.addEventListener('click',event=>{const home=event.target.closest('a[href="#inicio"]');if(home){event.preventDefault();handleTab('home');return;}const story=event.target.closest('a[href="#nosotros"]');if(story)document.body.classList.remove('mobile-catalog-active');const anchor=event.target.closest('a[href="#shop"],a[href="#shopResults"]');if(!anchor)return;if(anchor.dataset.categoryNav){selectedCategory=anchor.dataset.categoryNav;chips.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileCat===selectedCategory)));}document.body.classList.add('mobile-catalog-active');setActive('shop');});
    if(['#shop','#shopResults'].includes(location.hash))chooseCategory('All');
    window.addEventListener('hashchange',()=>{if(['#shop','#shopResults'].includes(location.hash))chooseCategory('All');});
    let tries=0; const timer=setInterval(()=>{tries++; if(getProducts().length){clearInterval(timer);renderFeatured();renderSearch('');} if(tries>80)clearInterval(timer);},125);
    watchCart();
    window.addEventListener('raices:store-ready',()=>{ if(pendingCategory!==null){const cat=pendingCategory;pendingCategory=null;chooseCategory(cat);}renderFeatured(); renderSearch(document.getElementById('appSearchInput')?.value||''); });
    // CMS collections are loaded asynchronously. Keep the conversion-focused mobile
    // cards synchronized with the same images published from NURAI Contenido Web.
    window.addEventListener('raices:siteContentUpdated',()=>{updateMobileCategoryImages();updateHero();});
    updateMobileCategoryImages();
    // v13.1.1: never force a page reload on language/auth changes.
    // The previous reload handler could create an endless refresh loop after login
    // when the account language and the locally stored language were reconciled.
    window.addEventListener('raices:languageChanged',()=>{
      // Rebuild the compact mobile interface so every hardcoded app label
      // immediately reflects the newly selected language.
      const wasSearchOpen=document.body.classList.contains('app-search-open');
      const currentQuery=document.getElementById('appSearchInput')?.value||'';
      const currentTab=document.querySelector('.app-nav-btn.active')?.dataset.appTab||'home';

      document.getElementById('appHome')?.remove();
      document.getElementById('appSearch')?.remove();
      document.querySelector('.app-bottom-nav')?.remove();
      createShell();rebuildChips();headerSearch.setAttribute('aria-label',txt('Buscar productos','Search products'));

      renderFeatured();
      renderSearch(currentQuery);
      syncCartCount();

      if(wasSearchOpen){
        openSearch();
        const input=document.getElementById('appSearchInput');
        if(input){ input.value=currentQuery; renderSearch(currentQuery); }
      }else{
        setActive(currentTab);
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();

/* MyRaíces v13.1 — lightweight mobile add confirmation */
(function(){
  if(!window.matchMedia('(max-width:760px)').matches) return;
  function language(){ return window.raicesLang || localStorage.getItem('raices_lang') || 'es'; }
  function ensureToast(){
    let toast=document.getElementById('appAddedToast');
    if(toast) return toast;
    toast=document.createElement('div');
    toast.id='appAddedToast'; toast.className='app-added-toast';
    toast.innerHTML='<img alt=""><div><strong></strong><small></small></div><button type="button"></button>';
    document.body.appendChild(toast);
    toast.querySelector('button').addEventListener('click',()=>document.getElementById('openCart')?.click());
    return toast;
  }
  window.addEventListener('raices:productAdded',event=>{
    const product=event.detail?.product; if(!product) return;
    const qty=Number(event.detail?.quantity||1); const toast=ensureToast();
    toast.querySelector('img').src=window.RaicesImages.url(product.image||'/assets/raices-logo.webp',160);
    toast.querySelector('img').alt=product.name||'';
    toast.querySelector('strong').textContent=product.name||'';
    toast.querySelector('small').textContent=language()==='es' ? `${qty} agregado${qty>1?'s':''} al carrito` : `${qty} added to cart`;
    toast.querySelector('button').textContent=language()==='es' ? 'Ver carrito' : 'View cart';
    toast.classList.add('show'); clearTimeout(toast._timer); toast._timer=setTimeout(()=>toast.classList.remove('show'),3600);
    document.querySelector('.app-nav-cart')?.animate([{transform:'scale(1)'},{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:360});
  });
})();
