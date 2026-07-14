/* Raíces v116 — Supabase catalog bridge
   Hybrid migration:
   - Existing static catalog remains as a safe fallback.
   - A Supabase product with the same SKU overrides its static counterpart.
   - New active/sold-out Supabase products are appended.
   - Draft, hidden and archived Supabase products are not shown.
*/
(function () {
  const FALLBACK_IMAGE = "assets/raices-logo.png";

  const categoryMap = {
    cocina: "Kitchen",
    kitchen: "Kitchen",
    herbal: "Herbal",
    dulces: "Desserts",
    desserts: "Desserts",
    home: "Home",
    wellness: "Wellness",
  };

  const collectionMap = {
    arepas: "Signature Arepas",
    empanadas: "Signature Empanadas",
    proteínas: "Protein Craft Collection",
    proteinas: "Protein Craft Collection",
    "tés & infusiones": "Three Moments",
    "tes & infusiones": "Three Moments",
    postres: "Signature Desserts",
    "tea ware": "Home Rituals",
    ebooks: "The Library",
  };

  function normalize(value) {
    return String(value || "").trim();
  }

  function currentLanguage() {
    return window.raicesLang || localStorage.getItem("raices_lang") || "es";
  }

  function mapCategory(row) {
    const raw = normalize(row.collection).toLowerCase();
    return categoryMap[raw] || normalize(row.collection) || "Kitchen";
  }

  function mapCollection(row) {
    const rawCategory = normalize(row.category).toLowerCase();
    return collectionMap[rawCategory] || normalize(row.collection) || "Raíces";
  }

  function formatWeight(row) {
    if (row.weight_unit === "digital") return "Digital";
    if (row.weight_value === null || row.weight_value === undefined) return "";
    const unit = row.weight_unit === "fl_oz" ? "fl oz" : normalize(row.weight_unit);
    return `${row.weight_value} ${unit}`.trim();
  }

  function defineLocalized(product, field, esValue, enValue) {
    Object.defineProperty(product, field, {
      configurable: true,
      enumerable: true,
      get() {
        return currentLanguage() === "en"
          ? normalize(enValue) || normalize(esValue)
          : normalize(esValue) || normalize(enValue);
      },
    });
  }

  function toStoreProduct(row, staticProduct) {
    const product = {
      ...(staticProduct || {}),
      id: row.id,
      sku: normalize(row.sku),
      slug: normalize(row.slug) || staticProduct?.slug || normalize(row.sku).toLowerCase(),
      category: mapCategory(row),
      collection: mapCollection(row),
      subcategory: normalize(row.category) || staticProduct?.subcategory || "",
      unit: Number(row.units_per_pack || 1) > 1 ? "Paquete" : (row.weight_unit === "digital" ? "Digital" : "Unidad"),
      unitsPerPackage: Number(row.units_per_pack || 1),
      unitWeight: formatWeight(row) || staticProduct?.unitWeight || "",
      netWeight: staticProduct?.netWeight || "",
      price: Number(row.price || 0),
      unitPrice: Number(row.unit_price || 0),
      image: normalize(row.image_url) || staticProduct?.image || FALLBACK_IMAGE,
      available: row.status === "active" && (row.stock === null || Number(row.stock) > 0),
      soldOut: row.status === "sold_out" || (row.stock !== null && Number(row.stock) <= 0),
      status: normalize(row.status),
      featured: Boolean(row.featured),
      sortOrder: Number(row.sort_order || 0),
      stock: row.stock === null ? null : Number(row.stock),
      tags: Array.isArray(row.tags) ? row.tags : [],
      taxable: staticProduct?.taxable ?? null,
      benefits: staticProduct?.benefits || [],
      ingredients: staticProduct?.ingredients || "",
      conservation: staticProduct?.conservation || "",
      preparation: staticProduct?.preparation || "",
      moment: staticProduct?.moment || "",
      relatedHint: staticProduct?.relatedHint || "Combina con otros productos Raíces",
      source: "supabase",
    };

    defineLocalized(product, "name", row.name_es, row.name_en);
    defineLocalized(product, "description", row.description_es, row.description_en);
    defineLocalized(product, "longDescription", row.description_es, row.description_en);

    return product;
  }

  function mergeCatalog(staticProducts, rows) {
    const dbBySku = new Map(rows.map((row) => [normalize(row.sku), row]));
    const merged = [];

    staticProducts.forEach((staticProduct) => {
      const row = dbBySku.get(normalize(staticProduct.sku));
      if (!row) {
        merged.push(staticProduct);
        return;
      }

      dbBySku.delete(normalize(staticProduct.sku));

      if (["draft", "hidden", "archived"].includes(row.status)) return;
      merged.push(toStoreProduct(row, staticProduct));
    });

    dbBySku.forEach((row) => {
      if (["active", "sold_out"].includes(row.status)) {
        merged.push(toStoreProduct(row, null));
      }
    });

    return merged.sort((a, b) => {
      const orderA = Number(a.sortOrder ?? 9999);
      const orderB = Number(b.sortOrder ?? 9999);
      if (orderA !== orderB) return orderA - orderB;
      return normalize(a.name).localeCompare(normalize(b.name));
    });
  }

  async function loadDatabaseProducts() {
    const staticProducts = Array.isArray(window.RAICES_PRODUCTS)
      ? window.RAICES_PRODUCTS.slice()
      : [];

    if (!window.raicesSupabase) {
      console.warn("[Raíces Catalog] Supabase is unavailable. Using static catalog.");
      return { products: staticProducts, source: "static" };
    }

    const { data, error } = await window.raicesSupabase
      .from("products")
      .select(`
        id, sku, name_es, name_en, description_es, description_en,
        collection, category, price, unit_price, units_per_pack,
        weight_value, weight_unit, stock, status, featured,
        image_url, sort_order, slug, tags
      `)
      .in("status", ["active", "sold_out"])
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("[Raíces Catalog] Database load failed. Using static catalog.", error);
      return { products: staticProducts, source: "static", error };
    }

    return {
      products: mergeCatalog(staticProducts, Array.isArray(data) ? data : []),
      source: "hybrid",
      count: Array.isArray(data) ? data.length : 0,
    };
  }

  window.RAICES_CATALOG_DATABASE_READY = loadDatabaseProducts()
    .then((result) => {
      window.RAICES_PRODUCTS = result.products;
      window.RAICES_CATALOG_SOURCE = result.source;
      console.info(
        `[Raíces Catalog] ${result.source} catalog ready with ${result.products.length} products.`
      );
      return result;
    })
    .catch((error) => {
      console.warn("[Raíces Catalog] Unexpected loader failure. Using static catalog.", error);
      return {
        products: Array.isArray(window.RAICES_PRODUCTS) ? window.RAICES_PRODUCTS : [],
        source: "static",
        error,
      };
    });
})();
