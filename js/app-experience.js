(function(){
  const mq = window.matchMedia('(max-width:760px)');
  if(!mq.matches) return;
  document.body.classList.add('app-experience');

  const money = value => '$' + Number(value || 0).toFixed(2);
  const lang = () => window.raicesLang || localStorage.getItem('raices_lang') || 'es';
  const txt = (es,en) => lang()==='es' ? es : en;
  const icon = name => ({
    home:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>',
    cart:'<svg viewBox="0 0 24 24"><path d="M4 5h2l2 10h9l2-7H7M9 20h.01M17 20h.01"/></svg>',
    orders:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></svg>',
    profile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.6-4.3 3.3-7 8-7s7.4 2.7 8 7"/></svg>'
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
    clickExisting(`[data-category-nav="${cat}"]`);
    setActive('shop');
    setTimeout(()=>document.getElementById('shopResults')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  }
  function pulseCart(){ document.querySelector('.app-nav-cart')?.animate([{transform:'scale(1)'},{transform:'scale(1.13)'},{transform:'scale(1)'}],{duration:360}); }

  function createShell(){
    const shell=document.createElement('section'); shell.className='app-shell'; shell.id='appHome';
    shell.innerHTML=`
      <div class="app-greeting"><div><small>${txt('Bienvenido a Raíces','Welcome to Raíces')}</small><h1>${txt('¿Qué necesitas hoy?','What do you need today?')}</h1></div><button class="app-avatar js-auth-open" aria-label="Perfil">R</button></div>
      <button class="app-search-trigger" type="button"><span>⌕</span><span>${txt('Buscar arepas, tés, proteínas...','Search arepas, teas, proteins...')}</span></button>
      <div class="app-prompt"><h2>${txt('Compra según tu momento','Shop for your moment')}</h2></div>
      <div class="app-intent-grid">
        <button class="app-intent" data-cat="Kitchen" style="background-image:url('/assets/categories/category-kitchen.webp')"><span>${txt('Comer fácil','Easy meals')}<small>${txt('Arepas, empanadas y proteínas','Arepas, empanadas & proteins')}</small></span></button>
        <button class="app-intent" data-cat="Herbal" style="background-image:url('/assets/categories/category-herbal.webp')"><span>${txt('Un momento de calma','A moment of calm')}<small>${txt('Tés e infusiones','Teas & infusions')}</small></span></button>
        <button class="app-intent" data-cat="Desserts" style="background-image:url('/assets/categories/category-desserts.webp')"><span>${txt('Algo dulce','Something sweet')}<small>${txt('Postres artesanales','Handcrafted desserts')}</small></span></button>
        <button class="app-intent" data-cat="Wellness" style="background-image:url('/assets/categories/category-wellness.webp')"><span>${txt('Volver a mí','Come back to me')}<small>${txt('Guías y rituales','Guides & rituals')}</small></span></button>
      </div>
      <div class="app-section-row"><h2 class="app-section-title">${txt('Para comenzar','Start here')}</h2><button data-see-all>${txt('Ver todo','See all')}</button></div>
      <div class="app-product-rail" id="appFeatured"></div>
      <div class="app-section-row"><h2 class="app-section-title">${txt('Accesos rápidos','Quick access')}</h2></div>
      <div class="app-quick-strip">
        <button class="app-quick" data-cat="Kitchen"><b>🥟</b><small>${txt('Cocina','Kitchen')}</small></button>
        <button class="app-quick" data-cat="Home"><b>🫖</b><small>Home</small></button>
        <button class="app-quick" data-search-open><b>⌕</b><small>${txt('Buscar','Search')}</small></button>
      </div>`;
    const main=document.querySelector('main'); main?.parentNode.insertBefore(shell,main);

    const search=document.createElement('section'); search.className='app-search-screen'; search.id='appSearch';
    search.setAttribute('aria-hidden','true'); search.innerHTML=`<div class="app-search-head"><button class="app-back" type="button" aria-label="${txt('Volver','Back')}">‹</button><label class="app-search-box"><span>⌕</span><input id="appSearchInput" type="search" autocomplete="off" placeholder="${txt('¿Qué estás buscando?','What are you looking for?')}"></label></div><div class="app-search-summary" id="appSearchSummary"></div><div class="app-search-results" id="appSearchResults"></div>`;
    document.body.appendChild(search);

    const nav=document.createElement('nav'); nav.className='app-bottom-nav'; nav.setAttribute('aria-label','App');
    nav.innerHTML=`
      <button class="app-nav-btn active" data-app-tab="home">${icon('home')}<span>${txt('Inicio','Home')}</span></button>
      <button class="app-nav-btn" data-app-tab="search">${icon('search')}<span>${txt('Buscar','Search')}</span></button>
      <button class="app-nav-btn app-nav-cart" data-app-tab="cart">${icon('cart')}<span>${txt('Carrito','Cart')}</span><i class="app-nav-badge" id="appCartCount">0</i></button>
      <button class="app-nav-btn" data-app-tab="orders">${icon('orders')}<span>${txt('Pedidos','Orders')}</span></button>
      <button class="app-nav-btn" data-app-tab="profile">${icon('profile')}<span>${txt('Perfil','Profile')}</span></button>`;
    document.body.appendChild(nav);

    shell.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>chooseCategory(b.dataset.cat)));
    shell.querySelector('[data-see-all]')?.addEventListener('click',()=>chooseCategory('Kitchen'));
    shell.querySelectorAll('.app-search-trigger,[data-search-open]').forEach(b=>b.addEventListener('click',openSearch));
    search.querySelector('.app-back').addEventListener('click',closeSearch);
    search.querySelector('#appSearchInput').addEventListener('input',e=>renderSearch(e.target.value));
    nav.querySelectorAll('[data-app-tab]').forEach(b=>b.addEventListener('click',()=>handleTab(b.dataset.appTab)));
  }

  function handleTab(tab){
    if(tab==='home'){ closeSearch(); setActive('home'); window.scrollTo({top:0,behavior:'smooth'}); }
    if(tab==='search') openSearch();
    if(tab==='cart'){ document.getElementById('openCart')?.click(); setActive('cart'); }
    if(tab==='orders'||tab==='profile'){ document.querySelector('.js-auth-open')?.click(); setActive(tab); }
  }
  function setActive(tab){ document.querySelectorAll('.app-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.appTab===tab)); }
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
    setActive('home');
  }
  function productCard(p){
    const available=p.available!==false&&!p.soldOut;
    return `<article class="app-product-card"><button type="button" data-app-view="${p.sku}" style="border:0;padding:0;background:none;width:100%;text-align:left"><img src="${p.image}" alt="${p.name}" loading="lazy"><div class="app-product-info"><h3>${p.name}</h3><p>${p.subcategory||p.collection||''}</p><div class="app-product-bottom"><span class="app-price">${money(p.price)}</span>${available?`<button class="app-add" type="button" data-app-add="${p.sku}">${txt('Agregar','Add')}</button>`:`<span>${txt('Agotado','Sold out')}</span>`}</div></div></button></article>`;
  }
  function bindCards(root){
    root.querySelectorAll('[data-app-view]').forEach(b=>b.addEventListener('click',e=>{ if(e.target.closest('[data-app-add]')) return; openProduct(b.dataset.appView); }));
    root.querySelectorAll('[data-app-add]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();addProduct(b.dataset.appAdd);}));
  }
  function renderFeatured(){
    const root=document.getElementById('appFeatured'); if(!root) return;
    const ps=getProducts().filter(p=>p.available!==false&&!p.soldOut).slice(0,8); root.innerHTML=ps.map(productCard).join(''); bindCards(root);
  }
  function miniCard(p){
    const available=p.available!==false&&!p.soldOut;
    return `<article class="app-mini-card" data-search-product="${p.sku}">
      <button class="app-mini-view" type="button" data-app-view="${p.sku}">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <div class="app-mini-body"><h3>${p.name}</h3><div class="app-mini-actions"><span>${money(p.price)}</span></div></div>
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
    let tries=0; const timer=setInterval(()=>{tries++; if(getProducts().length){clearInterval(timer);renderFeatured();renderSearch('');} if(tries>80)clearInterval(timer);},125);
    watchCart();
    window.addEventListener('raices:store-ready',()=>{ renderFeatured(); renderSearch(document.getElementById('appSearchInput')?.value||''); });
    window.addEventListener('raices:languageChanged',()=>location.reload());
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
    toast.querySelector('img').src=product.image||'/assets/raices-logo.webp';
    toast.querySelector('img').alt=product.name||'';
    toast.querySelector('strong').textContent=product.name||'';
    toast.querySelector('small').textContent=language()==='es' ? `${qty} agregado${qty>1?'s':''} al carrito` : `${qty} added to cart`;
    toast.querySelector('button').textContent=language()==='es' ? 'Ver carrito' : 'View cart';
    toast.classList.add('show'); clearTimeout(toast._timer); toast._timer=setTimeout(()=>toast.classList.remove('show'),3600);
    document.querySelector('.app-nav-cart')?.animate([{transform:'scale(1)'},{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:360});
  });
})();
