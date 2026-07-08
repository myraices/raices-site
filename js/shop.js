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
    productGrid.innerHTML = list.map(p => `<article class="product-card-shop">
      <div class="product-media" style="background-image:url('${p.image}')">
        <span class="product-badge">${translateSubcategory(p.subcategory)}</span>
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
        <div class="product-bottom">
          <span class="price">${money(p.price)}</span>
          <button class="btn add-btn" data-add="${p.sku}">${t('add')}</button>
        </div>
      </div>
    </article>`).join("");
    productGrid.querySelectorAll("[data-add]").forEach(btn => {
      btn.addEventListener("click", function(){
        addToCart(this.dataset.add);
      });
    });
  }

  function addToCart(sku){
    const product = products.find(p => p.sku === sku);
    if(!product) return;
    const existing = cart.find(item => item.sku === sku);
    if(existing) existing.qty += 1;
    else cart.push({ sku: product.sku, qty: 1 });
    saveCart();
    if(cartDrawer) cartDrawer.classList.add("open");
  }

  function updateQty(sku, delta){
    const item = cart.find(i => i.sku === sku);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0) cart = cart.filter(i => i.sku !== sku);
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
    cartItems.innerHTML = enriched.map(item => `<div class="cart-item">
      <div class="cart-item-img" style="background-image:url('${item.product.image}')"></div>
      <div>
        <h4>${item.product.name}</h4>
        <p>${money(item.product.price)} · ${translateUnit(item.product.unit) || ""}</p>
        <div class="qty-controls">
          <button data-qty="${item.sku}" data-delta="-1">−</button>
          <strong>${item.qty}</strong>
          <button data-qty="${item.sku}" data-delta="1">+</button>
        </div>
      </div>
      <strong>${money(item.qty * Number(item.product.price || 0))}</strong>
    </div>`).join("");
    cartItems.querySelectorAll("[data-qty]").forEach(btn => {
      btn.addEventListener("click", function(){
        updateQty(this.dataset.qty, Number(this.dataset.delta));
      });
    });
  }

  if(openCart) openCart.addEventListener("click", function(){ cartDrawer.classList.add("open"); });
  if(closeCart) closeCart.addEventListener("click", function(){ cartDrawer.classList.remove("open"); });

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
