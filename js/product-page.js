/* v20.3 — Product pages hydrate from the same Supabase product record used by NURAI. */
(function () {
  const normalize = (value) => String(value || "").trim();
  const lang = () => window.raicesLang || localStorage.getItem("raices_lang") || document.documentElement.lang || "es";
  const localized = (row, es, en, legacy) => lang() === "en"
    ? normalize(row[en]) || normalize(row[es]) || normalize(row[legacy])
    : normalize(row[es]) || normalize(row[legacy]) || normalize(row[en]);
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const setText = (selector, value) => { const el = document.querySelector(selector); if (el && value) el.textContent = value; };
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setList = (selector, values) => {
    const el = document.querySelector(selector); if (!el || !Array.isArray(values) || !values.length) return;
    el.innerHTML = values.map((item) => `<li>${escape(item)}</li>`).join("");
  };
  const setTags = (row) => {
    const tags = lang() === "en"
      ? (Array.isArray(row.tags_en) && row.tags_en.length ? row.tags_en : (Array.isArray(row.tags) ? row.tags : []))
      : (Array.isArray(row.tags) ? row.tags : []);
    let el = document.querySelector(".product-feature-tags--page");
    if (!tags.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div");
      el.className = "product-feature-tags product-feature-tags--page";
      el.setAttribute("aria-label", lang() === "en" ? "Product features" : "Características del producto");
      const lead = document.querySelector(".product-copy .lead");
      if (lead) lead.insertAdjacentElement("afterend", el);
    }
    el.innerHTML = tags.map(tag => `<span>${escape(tag)}</span>`).join("");
  };
  async function hydrate() {
    if (!window.raicesSupabase) return;
    const parts = location.pathname.split("/").filter(Boolean);
    const slug = parts[0] === "products" ? parts[1] : "";
    if (!slug) return;
    const { data: row, error } = await window.raicesSupabase.from("products").select("*").eq("slug", slug).maybeSingle();
    if (error || !row) return;
    const name = localized(row, "name_es", "name_en");
    const intro = localized(row, "long_description_es", "long_description_en") || localized(row, "description_es", "description_en");
    const ingredients = localized(row, "ingredients_text_es", "ingredients_text_en", "ingredients_text");
    const conservation = localized(row, "conservation_text_es", "conservation_text_en", "conservation_text");
    const preparation = localized(row, "preparation_text_es", "preparation_text_en", "preparation_text");
    const benefits = lang() === "en"
      ? (Array.isArray(row.benefits_en) && row.benefits_en.length ? row.benefits_en : row.benefits)
      : (Array.isArray(row.benefits_es) && row.benefits_es.length ? row.benefits_es : row.benefits);
    setText(".product-copy .eyebrow", normalize(row.display_collection) || normalize(row.category) || normalize(row.collection));
    setText(".product-copy h1", name);
    setText(".product-copy .lead", intro);
    setText(".product-copy .price", money(row.price));
    setTags(row);
    setList(".details .detail:nth-child(1) ul", benefits);
    setText(".details .detail:nth-child(2) p", ingredients);
    setText(".details .detail:nth-child(3) p", conservation);
    setText(".details .detail:nth-child(4) p", preparation);
    const image = document.querySelector(".product-image img");
    if (image && row.image_url) { image.src = row.image_url; image.alt = name || image.alt; image.style.objectPosition = normalize(row.image_position) || "center"; }
    if (name) document.title = `${name} | Raíces`;
    const meta = document.querySelector('meta[name="description"]'); if (meta && intro) meta.content = intro;
    const ogTitle = document.querySelector('meta[property="og:title"]'); if (ogTitle && name) ogTitle.content = `${name} | Raíces`;
    const ogDescription = document.querySelector('meta[property="og:description"]'); if (ogDescription && intro) ogDescription.content = intro;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hydrate); else hydrate();
})();
