/* Raíces unified catalog — Supabase is the single source of truth. */
(function () {
  const FALLBACK_IMAGE = "assets/raices-logo.webp";
  const categoryMap = { cocina:"Kitchen", kitchen:"Kitchen", herbal:"Herbal", dulces:"Desserts", desserts:"Desserts", home:"Home", wellness:"Wellness" };
  const collectionMap = { arepas:"Signature Arepas", empanadas:"Signature Empanadas", "proteínas":"Protein Craft Collection", proteinas:"Protein Craft Collection", herbal:"Three Moments", postres:"Signature Desserts", home:"Home Rituals", "guías":"The Library", guias:"The Library" };
  const normalize = (value) => String(value || "").trim();
  const currentLanguage = () => window.raicesLang || localStorage.getItem("raices_lang") || "es";
  const localized = (row, es, en) => currentLanguage() === "en" ? normalize(row[en]) || normalize(row[es]) : normalize(row[es]) || normalize(row[en]);
  const localizedArray = (row, es, en, legacy) => currentLanguage() === "en"
    ? (Array.isArray(row[en]) && row[en].length ? row[en] : (Array.isArray(row[es]) && row[es].length ? row[es] : (Array.isArray(row[legacy]) ? row[legacy] : [])))
    : (Array.isArray(row[es]) && row[es].length ? row[es] : (Array.isArray(row[en]) && row[en].length ? row[en] : (Array.isArray(row[legacy]) ? row[legacy] : [])));
  const formatWeight = (row) => {
    if (row.weight_unit === "digital") return "Digital";
    if (row.weight_value === null || row.weight_value === undefined) return normalize(row.unit_weight_label);
    const unit = row.weight_unit === "fl_oz" ? "fl oz" : normalize(row.weight_unit);
    return `${row.weight_value} ${unit}`.trim();
  };
  function applyLocalization(product) {
    const row = product?._localizedSource;
    if (!row) return product;
    product.name = localized(row,"name_es","name_en");
    product.description = localized(row,"description_es","description_en");
    product.cardDescription = localized(row,"card_description_es","card_description_en") || localized(row,"description_es","description_en");
    product.badge = localized(row,"badge_es","badge_en");
    product.cardCta = localized(row,"card_cta_es","card_cta_en");
    product.longDescription = localized(row,"long_description_es","long_description_en") || localized(row,"description_es","description_en");
    product.benefits = localizedArray(row,"benefits_es","benefits_en","benefits");
    product.ingredients = localized(row,"ingredients_text_es","ingredients_text_en") || normalize(row.ingredients_text);
    product.conservation = localized(row,"conservation_text_es","conservation_text_en") || normalize(row.conservation_text);
    product.preparation = localized(row,"preparation_text_es","preparation_text_en") || normalize(row.preparation_text);
    product.moment = localized(row,"moment_text_es","moment_text_en") || normalize(row.moment_text);
    product.relatedHint = localized(row,"related_hint_es","related_hint_en") || normalize(row.related_hint) || (currentLanguage() === "en" ? "Pair with other Raíces products" : "Combina con otros productos Raíces");
    return product;
  }
  function toStoreProduct(row) {
    const displayCategory = normalize(row.display_category) || categoryMap[normalize(row.collection).toLowerCase()] || normalize(row.collection) || "Kitchen";
    const displayCollection = normalize(row.display_collection) || collectionMap[normalize(row.category).toLowerCase()] || normalize(row.category) || "Raíces";
    const product = {
      id: row.id, sku: normalize(row.sku), slug: normalize(row.slug) || normalize(row.sku).toLowerCase(),
      category: displayCategory, collection: displayCollection, subcategory: normalize(row.subcategory_label) || normalize(row.category),
      compareAtPrice: row.compare_at_price === null || row.compare_at_price === undefined ? null : Number(row.compare_at_price),
      imagePosition: normalize(row.image_position) || "center",
      unit: normalize(row.unit_label) || (Number(row.units_per_pack || 1) > 1 ? "Paquete" : (row.weight_unit === "digital" ? "Digital" : "Unidad")),
      unitsPerPackage: Number(row.units_per_pack || 1), unitWeight: normalize(row.unit_weight_label) || formatWeight(row), netWeight: normalize(row.net_weight_label),
      price: Number(row.price || 0), unitPrice: Number(row.unit_price || 0), image: normalize(row.image_url) || FALLBACK_IMAGE,
      available: row.stock === null || Number(row.stock) > 0,
      soldOut: row.stock !== null && Number(row.stock) <= 0, status: normalize(row.status),
      featured: Boolean(row.featured), sortOrder: Number(row.sort_order || 0), stock: row.stock === null ? null : Number(row.stock),
      tags: Array.isArray(row.tags) ? row.tags : [], taxable: row.taxable,
      variants: Array.isArray(row.variants) ? row.variants : [], source: "supabase",
      _localizedSource: row,
    };
    return applyLocalization(product);
  }
  function relocalizeProducts() {
    if (!Array.isArray(window.RAICES_PRODUCTS)) return;
    window.RAICES_PRODUCTS.forEach(applyLocalization);
  }
  async function loadDatabaseProducts() {
    if (!window.raicesSupabase) throw new Error("Supabase is unavailable.");
    const { data, error } = await window.raicesSupabase.from("products").select("*").in("status",["active","sold_out"]).order("sort_order",{ascending:true});
    if (error) throw error;
    return { products:(data || []).map(toStoreProduct), source:"supabase", count:(data || []).length };
  }
  window.RAICES_RELOCALIZE_PRODUCTS = relocalizeProducts;
  window.addEventListener("raices:languageChanged", relocalizeProducts);
  window.RAICES_CATALOG_DATABASE_READY = loadDatabaseProducts().then((result) => {
    window.RAICES_PRODUCTS = result.products; window.RAICES_CATALOG_SOURCE = result.source;
    console.info(`[Raíces Catalog] Supabase catalog ready with ${result.products.length} products.`); return result;
  }).catch((error) => {
    console.error("[Raíces Catalog] Database load failed.", error); window.RAICES_PRODUCTS=[]; window.RAICES_CATALOG_SOURCE="error";
    return { products:[], source:"error", error };
  });
})();
