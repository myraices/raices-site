// Public catalog rendering. Only anonymous credentials; never a service-role key.
const BASE = 'https://myraices.com';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const text = value => String(value ?? '').trim();
const categoryMap = {cocina:'cocina',kitchen:'cocina',herbal:'herbal',dulces:'dulces',desserts:'dulces',home:'home',wellness:'wellness'};
const categories = {cocina:'Cocina',herbal:'Herbal',dulces:'Dulces',home:'Home',wellness:'Wellness'};
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
function presentation(row) {
  const qty = Number(row.units_per_pack || 1);
  const unit = text(row.unit_label) || (qty > 1 ? 'Paquete' : row.weight_unit === 'digital' ? 'Digital' : row.weight_unit === 'lb' ? 'Lbs' : 'Unidad');
  const weight = text(row.net_weight_label || row.unit_weight_label) || (row.weight_value != null && row.weight_unit !== 'digital' ? `${row.weight_value} ${row.weight_unit === 'fl_oz' ? 'fl oz' : text(row.weight_unit)}` : '');
  return [unit, qty > 1 ? `${qty} unidades` : '', weight].filter(Boolean).join(' · ');
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
function shell({title,description='',url=BASE+'/',image='',schema=null,body,robots='index, follow, max-image-preview:large'}) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | MyRaíces</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${esc(robots)}"><link rel="canonical" href="${esc(url)}"><meta property="og:site_name" content="MyRaíces"><meta property="og:type" content="${schema?.['@type']==='Product'?'product':'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(imageUrl(image))}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(imageUrl(image))}">${schema?`<script type="application/ld+json">${json(schema)}</script>`:''}<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/css/seo-pages.css?v=3.1.31"><link rel="stylesheet" href="/css/catalog-pages.css?v=3.1.31"></head><body><header class="seo-header"><nav class="seo-nav" aria-label="Principal"><a class="seo-logo" href="/"><img src="/assets/raices-logo.webp" alt="MyRaíces" width="640" height="640"></a><div class="seo-nav-links">${Object.entries(categories).map(([slug,name])=>`<a href="/collections/${slug}/">${name}</a>`).join('')}<a href="/#shop">Tienda</a><a href="/blog">Blog</a></div></nav></header><main class="seo-main">${body}</main><footer class="seo-footer"><div class="seo-footer-inner"><div><strong>MyRaíces</strong><br>Comida real para tu día a día.</div><div><a href="/delivery-policy.html">Entregas</a> · <a href="/refund-policy.html">Devoluciones y reembolsos</a> · <a href="/privacy.html">Privacidad</a> · <a href="/terms.html">Términos</a><br><a href="mailto:info@myraices.com">info@myraices.com</a></div></div></footer><script src="/js/product-gallery.js?v=3.1.31" defer></script></body></html>`;
}
function renderProduct(row, requestedSlug) {
  const name=text(row.name_es||row.name_en), desc=text(row.long_description_es||row.description_es||row.description_en);
  const url=`${BASE}/products/${encodeURIComponent(requestedSlug)}/`, image=imageUrl(row.image_url), members=row._members||[row];
  const inStock=members.some(available);
  const offers=members.map(r=>({'@type':'Offer',url:productUrl(r),priceCurrency:'USD',price:Number(r.price||0).toFixed(2),availability:`https://schema.org/${available(r)?'InStock':'OutOfStock'}`}));
  const schema={'@context':'https://schema.org','@type':'Product',name,description:desc,sku:row.sku,image:[image],brand:{'@type':'Brand',name:'MyRaíces'},offers:offers.length===1?offers[0]:offers};
  const details=[['Características',row.benefits_es||row.benefits],['Ingredientes o composición',row.ingredients_text_es||row.ingredients_text],['Conservación',row.conservation_text_es||row.conservation_text],['Preparación y uso',row.preparation_text_es||row.preparation_text]];
  const gallery=(Array.isArray(row.gallery_images)?row.gallery_images:[]).filter(g=>g?.url).slice(0,8);
  const images=[{url:image,alt:name},...gallery];
  const buy=`/?product=${encodeURIComponent(row._members?row.web_group_slug:row.slug)}#shop`;
  const body=`<nav class="breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a> / <a href="/collections/${category(row)}/">${esc(categories[category(row)])}</a> / ${esc(name)}</nav><article class="product-layout" data-product-id="${esc(row.id)}"><div class="product-image"><img id="productGalleryImage" src="${esc(image)}" alt="${esc(name)}" width="900" height="900" fetchpriority="high" style="object-position:${['center','top','bottom','left','right'].includes(row.image_position)?row.image_position:'center'}">${images.length>1?`<div class="product-gallery" role="group" aria-label="Fotos del producto">${images.map((g,i)=>`<button type="button" data-gallery-src="${esc(imageUrl(g.url))}" data-gallery-alt="${esc(g.alt||name)}" aria-label="Ver foto ${i+1}" aria-pressed="${i===0}"><img src="${esc(imageUrl(g.url))}" alt="${esc(g.alt||name)}" loading="lazy"></button>`).join('')}</div>`:''}</div><div class="product-copy"><p class="eyebrow">${esc(row.display_collection||row.category||categories[category(row)])}</p><h1>${esc(name)}</h1>${desc?`<p class="lead">${esc(desc)}</p>`:''}<p class="product-presentation">${esc(presentation(row))}</p><div class="price">${money(row.price)}</div><p class="status">${inStock?'Disponible':'Agotado temporalmente'}</p>${row.weight_unit==='digital'||row.operational_type==='digital'?'<p>Producto digital. No incluye un libro físico.</p>':''}<a class="cta" href="${esc(buy)}">${inStock?'Comprar en la tienda':'Ver disponibilidad y avisarme'}</a>${row._members?`<section><h2>Opciones</h2><ul>${members.map(r=>`<li><a href="/products/${encodeURIComponent(r.slug)}/">${esc(r.web_variant_label_es||r.name_es)}</a> · ${money(r.price)} · ${available(r)?'Disponible':'Agotado'}</li>`).join('')}</ul></section>`:''}<div class="details">${details.filter(([,v])=>Array.isArray(v)?v.length:text(v)).map(([label,value])=>`<section class="detail"><h2>${label}</h2>${Array.isArray(value)?`<ul>${value.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:`<p>${esc(value)}</p>`}</section>`).join('')}</div></div></article>`;
  return shell({title:row.meta_title||name,description:row.meta_description||desc,url,image,schema,body});
}
function renderCollection(rows, slug) {
  const products=groups(rows.filter(r=>category(r)===slug));
  const descriptions={cocina:'Arepas, empanadas y proteínas. Consulta la presentación y disponibilidad de cada producto.',herbal:'Infusiones y mezclas. Consulta ingredientes, presentación y preparación en cada ficha.',dulces:'Postres para compartir. La disponibilidad aparece en cada producto.',home:'Objetos para el hogar. Consulta medidas, capacidad y piezas incluidas.',wellness:'Guías digitales. Consulta el contenido y formato antes de comprar.'};
  const body=`<nav class="breadcrumbs"><a href="/">Inicio</a> / ${categories[slug]}</nav><h1>${categories[slug]}</h1><p class="lead">${descriptions[slug]}</p><section class="product-grid">${products.map(row=>`<article class="product-card"><a href="${esc(productUrl(row))}"><img src="${esc(imageUrl(row.image_url))}" alt="${esc(row.name_es||row.name_en)}" width="600" height="450" loading="lazy"></a><div class="product-card-body"><p class="eyebrow">${esc(row.display_collection||row.category)}</p><h2><a href="${esc(productUrl(row))}">${esc(row.name_es||row.name_en)}</a></h2><p>${esc(row.card_description_es||row.description_es||'')}</p><p class="product-presentation">${esc(presentation(row))}</p><p>${(row._members||[row]).some(available)?'Disponible':'Agotado temporalmente'}</p><div class="product-card-bottom"><strong>${money(row.price)}</strong><a href="${esc(productUrl(row))}">Ver producto →</a></div></div></article>`).join('')||'<p>No hay productos publicados en esta colección. <a href="/#shop">Ver la tienda</a>.</p>'}</section>`;
  const schema={'@context':'https://schema.org','@type':'ItemList',itemListElement:products.map((r,i)=>({'@type':'ListItem',position:i+1,url:productUrl(r),name:r.name_es||r.name_en}))};
  return shell({title:categories[slug],description:descriptions[slug],url:`${BASE}/collections/${slug}/`,schema,body});
}
const errorPage = (title,message) => shell({title,robots:'noindex, follow',body:`<h1>${esc(title)}</h1><p>${esc(message)}</p><a class="cta" href="/#shop">Volver a la tienda</a>`});
module.exports={BASE,esc,json,category,categories,productUrl,available,presentation,loadCatalog,groups,findProduct,renderProduct,renderCollection,errorPage};
