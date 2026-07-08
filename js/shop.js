document.addEventListener("DOMContentLoaded", function(){
  const products = window.RAICES_PRODUCTS || [];
  const categories = window.RAICES_CATEGORIES || {};
  const collections = window.RAICES_COLLECTIONS || {};
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
  const openCart = document.getElementById("openCart");
  const closeCart = document.getElementById("closeCart");
  const cartItems = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");
  const cartSubtotal = document.getElementById("cartSubtotal");

  let activeCategory = "All";
  let activeCollection = "All";
  let cart = loadCart();

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
    if(currentLang()==='es') return product.longDescription || product.description || '';
    const map = {
      'Arepas': `${product.name} is part of Raíces' Signature Arepas Collection: handcrafted root-based arepas made with real ingredients, created to heat, serve and enjoy at home.`,
      'Empanadas': `${product.name} is part of Raíces' Signature Empanadas Collection: handmade cassava-based empanadas with honest fillings and natural colors inspired by the root.`,
      'Proteínas': `${product.name} belongs to the Protein Craft Collection: slow-cooked, ready-to-enjoy proteins designed to simplify nourishing meals.`,
      'Herbal': `${product.name} is a herbal ritual created to accompany your day with intention, balance and calm.`,
      'Postres': `${product.name} is part of the Signature Desserts Collection: sweetness with a more natural, thoughtful and handcrafted approach.`,
      'Home': `${product.name} belongs to Home Rituals: simple objects created to turn an everyday pause into a meaningful ritual.`,
      'Guías': `${product.name} is part of The Library: a digital guide created to support habits, conscious living and everyday wellbeing.`
    };
    return map[product.subcategory] || product.longDescription || product.description || '';
  }

  function productBenefit(product){
    if(currentLang()==='es') return product.benefits && product.benefits[0] ? product.benefits[0] : 'Ingredientes reales';
    const map = {Kitchen:'Made with real ingredients',Herbal:'Created for daily rituals',Desserts:'Handcrafted sweetness',Home:'Designed for mindful rituals',Wellness:'Practical digital content'};
    return map[product.category] || 'Created with intention';
  }

  function productConservation(product){
    if(currentLang()==='es') return product.conservation || 'Conservación según etiqueta';
    if(product.category==='Kitchen') return 'Keep frozen. Heat before serving.';
    if(product.category==='Wellness') return 'Digital product. No physical storage required.';
    if(product.category==='Home') return 'Care according to material.';
    return 'Store according to label instructions.';
  }

  function productPreparation(product){
    if(currentLang()==='es') return product.preparation || 'Listo para disfrutar';
    if(product.category==='Kitchen') return 'Heat in air fryer, pan or oven.';
    if(product.category==='Herbal') return 'Prepare as a warm or iced ritual.';
    if(product.category==='Wellness') return 'Download, read and apply at your own pace.';
    if(product.category==='Home') return 'Use as part of your tea or home ritual.';
    return 'Ready to enjoy.';
  }

  function money(value){
    return "$" + Number(value || 0).toFixed(2);
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

  function unitPiecesLabel(count){
    if(!count) return '';
    return currentLang() === 'es' ? `${count} uds` : `${count} pcs`;
  }

  function loadCart(){
    try { return JSON.parse(localStorage.getItem("raices_cart") || "[]"); }
    catch(e){ return []; }
  }

  function saveCart(){
    localStorage.setItem("raices_cart", JSON.stringify(cart));
    renderCart();
  }

  function renderDoors(){
    if(!categoryDoors) return;
    const order = ["Kitchen","Herbal","Desserts","Home","Wellness"];
    categoryDoors.innerHTML = order.map(cat => {
      const item = categories[cat];
      return `<a class="door-card" href="#shop" data-category-door="${cat}">
        <span class="door-bg" style="background-image:url('${item.image}')"></span>
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
        setTimeout(scrollToShopStart, 60);
      });
    });
  }

  function renderFilters(){
    if(!categoryFilters) return;
    const cats = ["All","Kitchen","Herbal","Desserts","Home","Wellness"];
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
    if(currentLang()==='es') return product.ingredients || 'Ingredientes reales según variedad.';
    if(product.category==='Kitchen') return 'Root-based dough and filling according to variety.';
    if(product.category==='Herbal') return 'Herbal blend according to formulation.';
    if(product.category==='Desserts') return 'Handcrafted ingredients according to flavor.';
    if(product.category==='Home') return 'Material and care details according to product.';
    if(product.category==='Wellness') return 'Digital guide content.';
    return product.ingredients || '';
  }

  function benefitList(product){
    if(currentLang()==='es' && Array.isArray(product.benefits) && product.benefits.length) return product.benefits;
    const byCategory = {
      Kitchen:['Made with real ingredients','Practical for everyday meals','Created to nourish with simplicity'],
      Herbal:['Created for daily rituals','A mindful pause for balance','Designed to accompany your routine'],
      Desserts:['Handcrafted sweetness','Inspired by natural ingredients','A thoughtful way to enjoy dessert'],
      Home:['Designed for meaningful rituals','Simple objects for everyday use','Created to elevate small moments'],
      Wellness:['Practical guidance','Designed for self-paced learning','Created to support better habits']
    };
    return byCategory[product.category] || ['Created with intention'];
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
    const related = relatedProducts(p).map(r => `<button class="ritual-card" data-related-add="${r.sku}"><span style="background-image:url('${r.image}')"></span><strong>${r.name}</strong><em>${money(r.price)}</em></button>`).join('');
    const hasVariants = Array.isArray(p.variants) && p.variants.length;
    const selectedVariant = hasVariants ? variantDisplay(p.variants[0]) : "";
    const variantBlock = hasVariants ? `
      <div class="variant-box">
        <label>${variantLabel(p)}</label>
        <div class="variant-options">
          ${p.variants.map((v, idx) => `<button type="button" class="variant-option ${idx===0?'active':''}" data-variant="${variantDisplay(v)}" data-variant-image="${v.image}">${variantDisplay(v)}</button>`).join('')}
        </div>
        <p>${variantIntro(p)}</p>
      </div>` : '';
    productModalContent.innerHTML = `
      <div class="product-modal-grid">
        <div class="product-modal-image" id="modalProductImage" style="background-image:url('${p.image}')"></div>
        <div class="product-modal-info">
          <p class="eyebrow">${collections[p.collection]?.title || p.collection}</p>
          <h2>${p.name}</h2>
          <p class="modal-description">${productDescription(p)}</p>
          <div class="product-meta modal-meta">${productMeta(p)}</div>
          ${variantBlock}
          <div class="modal-price-row"><strong>${money(p.price)}</strong><button class="btn" data-modal-add="${p.sku}" ${hasVariants ? `data-selected-variant="${selectedVariant}"` : ''}>${t('add_to_cart')}</button></div>
          <div class="modal-sections">
            <section><h3>${t('benefits')}</h3><ul>${benefits}</ul></section>
            <section><h3>${t('ingredients')}</h3><p>${localizedIngredients(p)}</p></section>
            <section><h3>${t('conservation')}</h3><p>${productConservation(p)}</p></section>
            <section><h3>${t('preparation')}</h3><p>${productPreparation(p)}</p></section>
            <section><h3>${t('ideal_moment')}</h3><p>${currentLang()==='es' ? (p.moment || 'Un ritual cotidiano de bienestar.') : 'An everyday wellness ritual.'}</p></section>
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
        if(modalAdd) modalAdd.dataset.selectedVariant = this.dataset.variant;
      });
    });

    productModalContent.querySelectorAll('[data-modal-add]').forEach(btn => btn.addEventListener('click', function(){ addToCart(this.dataset.modalAdd, this.dataset.selectedVariant || ""); }));
    productModalContent.querySelectorAll('[data-related-add]').forEach(btn => btn.addEventListener('click', function(){ addToCart(this.dataset.relatedAdd); }));
  }

  function closeProductModal(){
    if(!productModal) return;
    productModal.classList.remove('open');
    productModal.setAttribute('aria-hidden','true');
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
      const primaryAction = isRitualBox
        ? `<button class="btn personalize-btn" data-view="${p.sku}">${currentLang()==='es' ? 'Personalizar Ritual Box' : 'Customize Ritual Box'}</button>`
        : isConfigurable
          ? `<button class="btn personalize-btn" data-view="${p.sku}">${currentLang()==='es' ? 'Elegir opción' : 'Choose option'}</button>`
          : `<button class="text-product-link" data-view="${p.sku}">${p.category==='Wellness' ? (currentLang()==='es' ? 'Explorar guía' : 'Explore guide') : t('view_product')}</button>
           <button class="btn add-btn" data-add="${p.sku}">${t('add')}</button>`;
      return `<article class="product-card-shop ${isRitualBox ? 'is-ritual-box' : ''}">
      <div class="product-media" style="background-image:url('${p.image}')">
        <span class="product-badge">${isRitualBox ? (currentLang()==='es' ? 'Personalizable' : 'Customizable') : (p.category==='Wellness' ? (currentLang()==='es' ? 'Guía digital' : 'Digital guide') : translateSubcategory(p.subcategory))}</span>
      </div>
      <div class="product-body">
        <div>
          <p class="eyebrow">${collections[p.collection]?.title || p.collection}</p>
          <h3>${p.name}</h3>
        </div>
        <p>${productDescription(p)}</p>
        <div class="product-meta">${productMeta(p)}</div>
        <div class="product-details">
          <span>🌿 ${productBenefit(p)}</span>
          <span>❄ ${productConservation(p)}</span>
          <span>🔥 ${productPreparation(p)}</span>
        </div>
        <div class="product-bottom premium-actions">
          ${isRitualBox ? '' : `<span class="price">${money(p.price)}</span>`}
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
  }

  function addToCart(sku, variant){
    const product = products.find(p => p.sku === sku);
    if(!product) return;
    const key = cartItemKey(sku, variant);
    const existing = cart.find(item => cartItemKey(item.sku, item.variant) === key);
    if(existing) existing.qty += 1;
    else cart.push({ sku: product.sku, qty: 1, variant: variant || "" });
    saveCart();
    if(cartDrawer) cartDrawer.classList.add("open");
  }

  function updateQty(key, delta){
    const item = cart.find(i => cartItemKey(i.sku, i.variant) === key);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0) cart = cart.filter(i => cartItemKey(i.sku, i.variant) !== key);
    saveCart();
  }

  function renderCart(){
    const enriched = cart.map(item => ({...item, product: products.find(p => p.sku === item.sku)})).filter(i => i.product);
    const count = enriched.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = enriched.reduce((sum, item) => sum + item.qty * Number(item.product.price || 0), 0);
    if(cartCount) cartCount.textContent = count;
    if(cartSubtotal) cartSubtotal.textContent = money(subtotal);
    if(!cartItems) return;
    if(enriched.length === 0){
      cartItems.innerHTML = `<p class="cart-empty">${t('cart_empty')}</p>`;
      return;
    }
    cartItems.innerHTML = enriched.map(item => {
      const key = cartItemKey(item.sku, item.variant);
      const variantText = item.variant ? ` · ${item.variant}` : "";
      const variantImage = item.variant && Array.isArray(item.product.variants) ? (item.product.variants.find(v => v.name === item.variant)?.image || item.product.image) : item.product.image;
      return `<div class="cart-item">
      <div class="cart-item-img" style="background-image:url('${variantImage}')"></div>
      <div>
        <h4>${item.product.name}</h4>
        <p>${money(item.product.price)} · ${translateUnit(item.product.unit) || ""}${variantText}</p>
        <div class="qty-controls">
          <button data-qty="${key}" data-delta="-1">−</button>
          <strong>${item.qty}</strong>
          <button data-qty="${key}" data-delta="1">+</button>
        </div>
      </div>
      <strong>${money(item.qty * Number(item.product.price || 0))}</strong>
    </div>`;
    }).join("");
    cartItems.querySelectorAll("[data-qty]").forEach(btn => {
      btn.addEventListener("click", function(){
        updateQty(this.dataset.qty, Number(this.dataset.delta));
      });
    });
  }

  if(openCart) openCart.addEventListener("click", function(){ cartDrawer.classList.add("open"); });
  if(closeCart) closeCart.addEventListener("click", function(){ cartDrawer.classList.remove("open"); });
  if(productModalClose) productModalClose.addEventListener("click", closeProductModal);
  if(productModalBackdrop) productModalBackdrop.addEventListener("click", closeProductModal);
  document.addEventListener("keydown", function(e){ if(e.key === 'Escape') closeProductModal(); });

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

  window.addEventListener('raices:languageChanged', function(){
    renderDoors();
    renderFilters();
    renderProducts();
    renderCart();
  });

  renderDoors();
  renderFilters();
  renderProducts();
  renderCart();
});
