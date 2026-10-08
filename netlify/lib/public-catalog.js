// Public catalog rendering. Only anonymous credentials; never a service-role key.
const BASE = 'https://myraices.com';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const text = value => String(value ?? '').trim();
const categoryMap = {cocina:'cocina',kitchen:'cocina',herbal:'herbal',dulces:'dulces',desserts:'dulces',home:'home',wellness:'wellness'};
const categories = {cocina:'Cocina',herbal:'Herbal',dulces:'Dulces',home:'Home',wellness:'Wellness'};

const labels = {
 es:{cocina:'Cocina',herbal:'Herbal',dulces:'Dulces',home:'Home',wellness:'Wellness',start:'Inicio',shop:'Tienda',features:'Características',ingredients:'Ingredientes o composición',storage:'Conservación',preparation:'Preparación y uso',available:'Disponible',soldOut:'Agotado temporalmente',buy:'Comprar en la tienda',notify:'Ver disponibilidad y avisarme',options:'Opciones',photos:'Fotos del producto',photo:'Ver foto',digital:'Producto digital. No incluye un libro físico.',tagline:'Comida real para tu día a día.',delivery:'Entregas',refunds:'Devoluciones y reembolsos',privacy:'Privacidad',terms:'Términos',back:'Volver a la tienda',view:'Ver producto',empty:'No hay productos publicados en esta colección.',main:'Principal',breadcrumbs:'Migas de pan'},
 en:{cocina:'Kitchen',herbal:'Herbal',dulces:'Desserts',home:'Home',wellness:'Wellness',start:'Home',shop:'Shop',features:'Features',ingredients:'Ingredients or composition',storage:'Storage',preparation:'Preparation and use',available:'Available',soldOut:'Temporarily sold out',buy:'Buy in the shop',notify:'Check availability and notify me',options:'Options',photos:'Product photos',photo:'View photo',digital:'Digital product. Does not include a physical book.',tagline:'Real food for everyday meals.',delivery:'Delivery',refunds:'Returns and refunds',privacy:'Privacy',terms:'Terms',back:'Back to the shop',view:'View product',empty:'There are no published products in this collection.',main:'Main navigation',breadcrumbs:'Breadcrumbs'}
};
const normalizeLanguage = lang => lang === 'en' ? 'en' : 'es';
function languageUrl(url,lang) {
 const u=new URL(url,BASE+'/');u.searchParams.delete('lang');if(lang==='en')u.searchParams.set('lang','en');
 return url.startsWith('http')?u.href:u.pathname+u.search+u.hash;
}
function localizedRow(row,lang) {
 if(lang!=='en')return row;
 const result={...row};
 for(const field of ['name','description','long_description','card_description','ingredients_text','conservation_text','preparation_text','web_variant_label'])
   result[field+'_es']=text(row[field+'_en'])||row[field+'_es']||row[field];
 result.benefits_es=Array.isArray(row.benefits_en)&&row.benefits_en.length?row.benefits_en:row.benefits_es||row.benefits;
 const categoriesEn={'Proteínas':'Proteins','Proteinas':'Proteins','Proteina':'Protein','Proteína':'Protein','Arepas':'Arepas','Empanadas':'Empanadas','Postres':'Desserts','Guías':'Guides','Guias':'Guides'};
 result.category=categoriesEn[row.category]||row.category;
 result.meta_title=row.meta_title_en||result.name_es;
 result.meta_description=row.meta_description_en||result.long_description_es||result.description_es;
 if(row._members)result._members=row._members.map(r=>localizedRow(r,lang));
 return result;
}

function imageUrl(value) {
  const url = text(value);
  if (!url) return `${BASE}/assets/raices-logo.webp`;
  try { const u = new URL(url, BASE+'/'); return ['https:','http:'].includes(u.protocol) ? u.href : `${BASE}/assets/raices-logo.webp`; }
  catch { return `${BASE}/assets/raices-logo.webp`; }
}
const category = row => categoryMap[text(row.display_category || row.collection).toLowerCase()] || 'cocina';
const productUrl = row => `${BASE}/products/${encodeURIComponent(text(row.web_group_slug && row.web_group_key ? row.web_group_slug : row.slug))}/`;
const money = value => `$${Number(value || 0).toFixed(2)}`;
function available(row) {
  if (row.status === 'sold_out') return false;
  if (row.operational_type === 'digital' || row.weight_unit === 'digital' || row.is_inventory_tracked === false) return true;
  const stock = row._availableStock !== undefined ? row._availableStock : row.stock;
  return stock === null || stock === undefined || Number(stock) > 0;
}
function presentation(row,lang='es') {
  const qty = Number(row.units_per_pack || 1);
  let unit = text(row.unit_label) || (qty > 1 ? 'Paquete' : row.weight_unit === 'digital' ? 'Digital' : row.weight_unit === 'lb' ? 'Lbs' : 'Unidad');
  if(lang==='en')unit=({Paquete:'Pack',Bolsa:'Bag',Unidad:'Unit',Lata:'Tin',Caja:'Box'})[unit]||unit;
  const weight = text(row.net_weight_label || row.unit_weight_label) || (row.weight_value != null && row.weight_unit !== 'digital' ? `${row.weight_value} ${row.weight_unit === 'fl_oz' ? 'fl oz' : text(row.weight_unit)}` : '');
  return [unit, qty > 1 ? `${qty} ${lang==='en'?'units':'unidades'}` : '', weight].filter(Boolean).join(' · ');
}
async function request(path, fetcher = fetch) {
  const url = process.env.SUPABASE_URL || 'https://tqtnffinhqbyesjdollk.supabase.co';
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW';
  const res = await fetcher(`${url}/rest/v1/${path}`, {headers:{apikey:key, Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)});
  if (!res.ok) throw new Error(`Public catalog unavailable (${res.status})`);
  return res.json();
}
async function loadCatalog(fetcher = fetch) {
  const [rows, balances] = await Promise.all([
    request('products?select=*&status=in.(active,sold_out)&order=sort_order.asc&limit=1000',fetcher),
    request('inventory_balances?select=product_id,quantity,reserved_quantity&limit=1000',fetcher).catch(()=>null)
  ]);
  if (!Array.isArray(rows)) throw new Error('Invalid catalog response');
  // Stock remains authoritative in checkout. Use available balances when public RLS permits them.
  if (Array.isArray(balances)) {
    const stock = new Map(balances.map(b => [String(b.product_id),Math.max(0,Number(b.quantity||0)-Number(b.reserved_quantity||0))]));
    rows.forEach(row => { if(stock.has(String(row.id))) row._availableStock=stock.get(String(row.id)); });
  } // Same product-stock fallback as the existing public shop if balances are unavailable.
  return rows;
}
function groups(rows) {
  const result=[], mapped=new Map();
  for (const row of rows) {
    if (['RA-HM-001-SQ','RA-HM-001-RD'].includes(row.sku) || !row.web_group_key) {result.push(row);continue;}
    if (!mapped.has(row.web_group_key)) mapped.set(row.web_group_key,[]);
    mapped.get(row.web_group_key).push(row);
  }
  for (const members of mapped.values()) {
    const primary=members.find(r=>r.web_group_primary)||members[0];
    result.push({...primary,_members:members});
  }
  return result.sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
}
function findProduct(rows, slug) {
  // Group links can differ from individual inventory SKU slugs.
  const members=rows.filter(r=>r.web_group_key && text(r.web_group_slug)===slug && !['RA-HM-001-SQ','RA-HM-001-RD'].includes(r.sku));
  if(members.length) return {...(members.find(r=>r.web_group_primary)||members[0]),_members:members};
  const exact=rows.find(r=>text(r.slug)===slug);
  if(exact) return exact;
  return null;
}
function shell({title,description='',url=BASE+'/',image='',schema=null,body,robots='index, follow, max-image-preview:large',lang='es'}) {
  lang=normalizeLanguage(lang);const t=labels[lang];
  const baseUrl=new URL(url);baseUrl.searchParams.delete('lang');url=languageUrl(baseUrl.href,lang);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | MyRaíces</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${esc(robots)}"><link rel="canonical" href="${esc(url)}"><link rel="alternate" hreflang="es" href="${esc(languageUrl(baseUrl.href,'es'))}"><link rel="alternate" hreflang="en" href="${esc(languageUrl(baseUrl.href,'en'))}"><link rel="alternate" hreflang="x-default" href="${esc(languageUrl(baseUrl.href,'es'))}"><script src="/js/catalog-language.js?v=3.1.32"></script><meta property="og:site_name" content="MyRaíces"><meta property="og:type" content="${schema?.['@type']==='Product'?'product':'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(imageUrl(image))}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(imageUrl(image))}">${schema?`<script type="application/ld+json">${json(schema)}</script>`:''}<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/css/seo-pages.css?v=3.1.32"><link rel="stylesheet" href="/css/catalog-pages.css?v=3.1.32"></head><body><header class="seo-header"><nav class="seo-nav" aria-label="${t.main}"><a class="seo-logo" href="${languageUrl('/',lang)}"><img src="/assets/raices-logo.webp" alt="MyRaíces" width="640" height="640"></a><div class="seo-nav-links">${Object.entries(categories).map(([slug,name])=>`<a href="${languageUrl(`/collections/${slug}/`,lang)}">${t[slug]}</a>`).join('')}<a href="${languageUrl('/#shop',lang)}">${t.shop}</a><a href="${languageUrl('/blog',lang)}">Blog</a><button id="catalogLanguageToggle" type="button" aria-label="${lang==='en'?'Switch to Spanish':'Cambiar a inglés'}">${lang.toUpperCase()} ▾</button></div></nav></header><main class="seo-main">${body}</main><footer class="seo-footer"><div class="seo-footer-inner"><div><strong>MyRaíces</strong><br>${t.tagline}</div><div><a href="${languageUrl('/delivery-policy.html',lang)}">${t.delivery}</a> · <a href="${languageUrl('/refund-policy.html',lang)}">${t.refunds}</a> · <a href="${languageUrl('/privacy.html',lang)}">${t.privacy}</a> · <a href="${languageUrl('/terms.html',lang)}">${t.terms}</a><br><a href="mailto:info@myraices.com">info@myraices.com</a></div></div></footer><script src="/js/product-gallery.js?v=3.1.32" defer></script></body></html>`;
}
function renderProduct(row, requestedSlug, lang='es') {
  lang=normalizeLanguage(lang);const t=labels[lang];row=localizedRow(row,lang);
  const name=text(row.name_es||row.name_en), desc=text(row.long_description_es||row.description_es||row.description_en);
  const url=`${BASE}/products/${encodeURIComponent(requestedSlug)}/`, image=imageUrl(row.image_url), members=row._members||[row];
  const inStock=members.some(available);
  const offers=members.map(r=>({'@type':'Offer',url:languageUrl(productUrl(r),lang),priceCurrency:'USD',price:Number(r.price||0).toFixed(2),availability:`https://schema.org/${available(r)?'InStock':'OutOfStock'}`}));
  const schema={'@context':'https://schema.org','@type':'Product',name,description:desc,sku:row.sku,image:[image],brand:{'@type':'Brand',name:'MyRaíces'},offers:offers.length===1?offers[0]:offers};
  const details=[[t.features,row.benefits_es||row.benefits],[t.ingredients,row.ingredients_text_es||row.ingredients_text],[t.storage,row.conservation_text_es||row.conservation_text],[t.preparation,row.preparation_text_es||row.preparation_text]];
  const gallery=(Array.isArray(row.gallery_images)?row.gallery_images:[]).filter(g=>g?.url).slice(0,8);
  const images=[{url:image,alt:name},...gallery];
  const buy=languageUrl(`/?product=${encodeURIComponent(row._members?row.web_group_slug:row.slug)}#shop`,lang);
  const body=`<nav class="breadcrumbs" aria-label="${t.breadcrumbs}"><a href="${languageUrl('/',lang)}">${t.start}</a> / <a href="${languageUrl(`/collections/${category(row)}/`,lang)}">${esc(t[category(row)])}</a> / ${esc(name)}</nav><article class="product-layout" data-product-id="${esc(row.id)}"><div class="product-image"><img id="productGalleryImage" src="${esc(image)}" alt="${esc(name)}" width="900" height="900" fetchpriority="high" style="object-position:${['center','top','bottom','left','right'].includes(row.image_position)?row.image_position:'center'}">${images.length>1?`<div class="product-gallery" role="group" aria-label="${t.photos}">${images.map((g,i)=>`<button type="button" data-gallery-src="${esc(imageUrl(g.url))}" data-gallery-alt="${esc(g.alt||name)}" aria-label="${t.photo} ${i+1}" aria-pressed="${i===0}"><img src="${esc(imageUrl(g.url))}" alt="${esc(g.alt||name)}" loading="lazy"></button>`).join('')}</div>`:''}</div><div class="product-copy"><p class="eyebrow">${esc(row.display_collection||row.category||categories[category(row)])}</p><h1>${esc(name)}</h1>${desc?`<p class="lead">${esc(desc)}</p>`:''}<p class="product-presentation">${esc(presentation(row,lang))}</p><div class="price">${money(row.price)}</div><p class="status">${inStock?t.available:t.soldOut}</p>${row.weight_unit==='digital'||row.operational_type==='digital'?`<p>${t.digital}</p>`:''}<a class="cta" href="${esc(buy)}">${inStock?t.buy:t.notify}</a>${row._members?`<section><h2>${t.options}</h2><ul>${members.map(r=>`<li><a href="${languageUrl(`/products/${encodeURIComponent(r.slug)}/`,lang)}">${esc(r.web_variant_label_es||r.name_es)}</a> · ${money(r.price)} · ${available(r)?t.available:t.soldOut}</li>`).join('')}</ul></section>`:''}<div class="details">${details.filter(([,v])=>Array.isArray(v)?v.length:text(v)).map(([label,value])=>`<section class="detail"><h2>${label}</h2>${Array.isArray(value)?`<ul>${value.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:`<p>${esc(value)}</p>`}</section>`).join('')}</div></div></article>`;
  return shell({title:row.meta_title||name,description:row.meta_description||desc,url,image,schema,body,lang});
}
function renderCollection(rows, slug, lang='es') {
  lang=normalizeLanguage(lang);const t=labels[lang];
  const products=groups(rows.filter(r=>category(r)===slug)).map(r=>localizedRow(r,lang));
  const descriptions=lang==='en'?{cocina:'Arepas, empanadas and proteins. Check each product for package details and availability.',herbal:'Herbal infusions and blends. Check ingredients, package details and preparation on each product page.',dulces:'Desserts to share. Availability is shown on each product.',home:'Home objects. Check dimensions, capacity and included pieces.',wellness:'Digital guides. Check the content and format before buying.'}:{cocina:'Arepas, empanadas y proteínas. Consulta la presentación y disponibilidad de cada producto.',herbal:'Infusiones y mezclas. Consulta ingredientes, presentación y preparación en cada ficha.',dulces:'Postres para compartir. La disponibilidad aparece en cada producto.',home:'Objetos para el hogar. Consulta medidas, capacidad y piezas incluidas.',wellness:'Guías digitales. Consulta el contenido y formato antes de comprar.'};
  const body=`<nav class="breadcrumbs"><a href="${languageUrl('/',lang)}">${t.start}</a> / ${t[slug]}</nav><h1>${t[slug]}</h1><p class="lead">${descriptions[slug]}</p><section class="product-grid">${products.map(row=>`<article class="product-card"><a href="${esc(languageUrl(productUrl(row),lang))}"><img src="${esc(imageUrl(row.image_url))}" alt="${esc(row.name_es||row.name_en)}" width="600" height="450" loading="lazy"></a><div class="product-card-body"><p class="eyebrow">${esc(row.display_collection||row.category)}</p><h2><a href="${esc(languageUrl(productUrl(row),lang))}">${esc(row.name_es||row.name_en)}</a></h2><p>${esc(row.card_description_es||row.description_es||'')}</p><p class="product-presentation">${esc(presentation(row,lang))}</p><p>${(row._members||[row]).some(available)?t.available:t.soldOut}</p><div class="product-card-bottom"><strong>${money(row.price)}</strong><a href="${esc(languageUrl(productUrl(row),lang))}">${t.view} →</a></div></div></article>`).join('')||`<p>${t.empty} <a href="${languageUrl('/#shop',lang)}">${t.shop}</a>.</p>`}</section>`;
  const schema={'@context':'https://schema.org','@type':'ItemList',itemListElement:products.map((r,i)=>({'@type':'ListItem',position:i+1,url:languageUrl(productUrl(r),lang),name:r.name_es||r.name_en}))};
  return shell({title:t[slug],description:descriptions[slug],lang,url:`${BASE}/collections/${slug}/`,schema,body});
}
const errorPage = (title,message,lang='es') => shell({title,lang,robots:'noindex, follow',body:`<h1>${esc(title)}</h1><p>${esc(message)}</p><a class="cta" href="${languageUrl('/#shop',lang)}">${labels[normalizeLanguage(lang)].back}</a>`});
module.exports={normalizeLanguage,languageUrl,localizedRow,BASE,esc,json,category,categories,productUrl,available,presentation,loadCatalog,groups,findProduct,renderProduct,renderCollection,errorPage};
