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

  function money(value){
    return "$" + Number(value || 0).toFixed(2);
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
          <p>${item.tagline}</p>
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
        document.getElementById('shop')?.scrollIntoView({behavior:'smooth', block:'start'});
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
    });
  }

  function productMeta(product){
    const items = [];
    if(product.unit) items.push(product.unit);
    if(product.unitsPerPackage) items.push(product.unitsPerPackage + " uds");
    if(product.netWeight) items.push(product.netWeight);
    return items.map(x => `<span class="chip">${x}</span>`).join("");
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
      activeDescription.textContent = c.description;
    }

    if(!productGrid) return;
    productGrid.innerHTML = list.map(p => `<article class="product-card-shop">
      <div class="product-media" style="background-image:url('${p.image}')">
        <span class="product-badge">${p.subcategory}</span>
      </div>
      <div class="product-body">
        <div>
          <p class="eyebrow">${collections[p.collection]?.title || p.collection}</p>
          <h3>${p.name}</h3>
        </div>
        <p>${p.longDescription}</p>
        <div class="product-meta">${productMeta(p)}</div>
        <div class="product-details">
          <span>🌿 ${p.benefits && p.benefits[0] ? p.benefits[0] : "Ingredientes reales"}</span>
          <span>❄ ${p.conservation || "Conservación según etiqueta"}</span>
          <span>🔥 ${p.preparation || "Listo para disfrutar"}</span>
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
        <p>${money(item.product.price)} · ${item.product.unit || ""}</p>
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
      document.getElementById('shop')?.scrollIntoView({behavior:'smooth', block:'start'});
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
