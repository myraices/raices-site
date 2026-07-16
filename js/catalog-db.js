/* Raíces unified catalog — Supabase is the single source of truth. */
(function () {
  const FALLBACK_IMAGE = "assets/raices-logo.png";
  const categoryMap = { cocina:"Kitchen", kitchen:"Kitchen", herbal:"Herbal", dulces:"Desserts", desserts:"Desserts", home:"Home", wellness:"Wellness" };
  const collectionMap = { arepas:"Signature Arepas", empanadas:"Signature Empanadas", "proteínas":"Protein Craft Collection", proteinas:"Protein Craft Collection", herbal:"Three Moments", postres:"Signature Desserts", home:"Home Rituals", "guías":"The Library", guias:"The Library" };
  const normalize = (value) => String(value || "").trim();
  const currentLanguage = () => window.raicesLang || localStorage.getItem("raices_lang") || "es";
  const localized = (row, es, en) => currentLanguage() === "en" ? normalize(row[en]) || normalize(row[es]) : normalize(row[es]) || normalize(row[en]);
  const formatWeight = (row) => {
    if (row.weight_unit === "digital") return "Digital";
    if (row.weight_value === null || row.weight_value === undefined) return normalize(row.unit_weight_label);
    const unit = row.weight_unit === "fl_oz" ? "fl oz" : normalize(row.weight_unit);
    return `${row.weight_value} ${unit}`.trim();
  };
  function toStoreProduct(row) {
    const displayCategory = normalize(row.display_category) || categoryMap[normalize(row.collection).toLowerCase()] || normalize(row.collection) || "Kitchen";
    const displayCollection = normalize(row.display_collection) || collectionMap[normalize(row.category).toLowerCase()] || normalize(row.category) || "Raíces";
    return {
      id: row.id, sku: normalize(row.sku), slug: normalize(row.slug) || normalize(row.sku).toLowerCase(),
      category: displayCategory, collection: displayCollection, subcategory: normalize(row.subcategory_label) || normalize(row.category),
      name: localized(row,"name_es","name_en"), description: localized(row,"description_es","description_en"),
      longDescription: localized(row,"long_description_es","long_description_en") || localized(row,"description_es","description_en"),
      unit: normalize(row.unit_label) || (Number(row.units_per_pack || 1) > 1 ? "Paquete" : (row.weight_unit === "digital" ? "Digital" : "Unidad")),
      unitsPerPackage: Number(row.units_per_pack || 1), unitWeight: normalize(row.unit_weight_label) || formatWeight(row), netWeight: normalize(row.net_weight_label),
      price: Number(row.price || 0), unitPrice: Number(row.unit_price || 0), image: normalize(row.image_url) || FALLBACK_IMAGE,
      available: row.status === "active" && (row.stock === null || Number(row.stock) > 0),
      soldOut: row.status === "sold_out" || (row.stock !== null && Number(row.stock) <= 0), status: normalize(row.status),
      featured: Boolean(row.featured), sortOrder: Number(row.sort_order || 0), stock: row.stock === null ? null : Number(row.stock),
      tags: Array.isArray(row.tags) ? row.tags : [], taxable: row.taxable,
      benefits: Array.isArray(row.benefits) ? row.benefits : [], ingredients: normalize(row.ingredients_text), conservation: normalize(row.conservation_text),
      preparation: normalize(row.preparation_text), moment: normalize(row.moment_text), relatedHint: normalize(row.related_hint) || "Combina con otros productos Raíces",
      variants: Array.isArray(row.variants) ? row.variants : [], source: "supabase"
    };
  }
  async function loadDatabaseProducts() {
    if (!window.raicesSupabase) throw new Error("Supabase is unavailable.");
    const { data, error } = await window.raicesSupabase.from("products").select("*").in("status",["active","sold_out"]).order("sort_order",{ascending:true});
    if (error) throw error;
    return { products:(data || []).map(toStoreProduct), source:"supabase", count:(data || []).length };
  }
  window.RAICES_CATALOG_DATABASE_READY = loadDatabaseProducts().then((result) => {
    window.RAICES_PRODUCTS = result.products; window.RAICES_CATALOG_SOURCE = result.source;
    console.info(`[Raíces Catalog] Supabase catalog ready with ${result.products.length} products.`); return result;
  }).catch((error) => {
    console.error("[Raíces Catalog] Database load failed.", error); window.RAICES_PRODUCTS=[]; window.RAICES_CATALOG_SOURCE="error";
    return { products:[], source:"error", error };
  });
})();
