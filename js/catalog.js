/* Raíces v80 - Catálogo centralizado
   Fuente única para productos, categorías y colecciones.
   Las siguientes fases (carrito, checkout, Square, pedidos) deben leer desde window.RAICES_CATALOG.
*/
(function(){
  const products = Array.isArray(window.RAICES_PRODUCTS) ? window.RAICES_PRODUCTS : [];
  const categories = window.RAICES_CATEGORIES || {};
  const collections = window.RAICES_COLLECTIONS || {};

  function normalizeText(value){
    return String(value || '').trim();
  }

  function getProductBySku(sku){
    return products.find(product => product.sku === sku) || null;
  }

  function getProductsByCategory(category){
    if(!category || category === 'All') return products.slice();
    return products.filter(product => product.category === category);
  }

  function getProductsByCollection(collection){
    if(!collection || collection === 'All') return products.slice();
    return products.filter(product => product.collection === collection);
  }

  function getAvailableProducts(){
    return products.filter(product => product.available !== false);
  }

  function buildCartLine({ sku, quantity = 1, variant = null }){
    const product = getProductBySku(sku);
    if(!product) return null;
    const qty = Math.max(1, Number(quantity || 1));
    return {
      sku: product.sku,
      variant: variant ? normalizeText(variant) : null,
      quantity: qty,
      name: product.name,
      category: product.category,
      collection: product.collection,
      image: product.image,
      unit: product.unit,
      unitPrice: Number(product.price || 0),
      lineTotal: Number(product.price || 0) * qty,
      taxable: product.taxable
    };
  }

  function validateCatalog(){
    const issues = [];
    const seen = new Set();
    products.forEach((product, index) => {
      if(!product.sku) issues.push(`Product at index ${index} has no SKU`);
      if(product.sku && seen.has(product.sku)) issues.push(`Duplicate SKU: ${product.sku}`);
      if(product.sku) seen.add(product.sku);
      if(!product.name) issues.push(`Product ${product.sku || index} has no name`);
      if(product.price === undefined || product.price === null || isNaN(Number(product.price))) issues.push(`Product ${product.sku || index} has invalid price`);
      if(!product.image) issues.push(`Product ${product.sku || index} has no image`);
    });
    return issues;
  }

  window.RAICES_CATALOG = {
    version: 'v80',
    products,
    categories,
    collections,
    getProductBySku,
    getProductsByCategory,
    getProductsByCollection,
    getAvailableProducts,
    buildCartLine,
    validateCatalog
  };

  const issues = validateCatalog();
  if(issues.length){
    console.warn('[Raíces Catalog] Issues found:', issues);
  } else {
    console.info('[Raíces Catalog] Loaded', products.length, 'products.');
  }
})();
