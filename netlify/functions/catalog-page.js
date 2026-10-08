const catalog=require('../lib/public-catalog');
exports.handler=async event=>{
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'};
  const params=event.queryStringParameters||{};
  const lang=catalog.normalizeLanguage(params.lang);
  let kind=params.kind,slug=params.slug;
  if(!kind || !slug){
    const path=event.rawUrl?new URL(event.rawUrl).pathname:event.path||'';
    const match=path.match(/^\/(products|collections)\/([^/]+)\/?$/);
    if(match){kind=match[1];try{slug=decodeURIComponent(match[2]);}catch{slug='';}}
  }
  if(!['products','collections'].includes(kind)||!slug||/[\x00-\x1f/]/.test(slug)||slug.length>200)
    return {statusCode:404,headers,body:catalog.errorPage(lang==='en'?'Page not found':'Página no encontrada',lang==='en'?'This address does not match an available page.':'La dirección no corresponde a una página disponible.',lang)};
  if(kind==='collections'&&!catalog.categories[slug])
    return {statusCode:404,headers,body:catalog.errorPage(lang==='en'?'Collection not found':'Colección no encontrada',lang==='en'?'You can browse our collections in the shop.':'Puedes consultar nuestras colecciones en la tienda.',lang)};
  try{
    const rows=await catalog.loadCatalog();
    if(kind==='collections')return {statusCode:200,headers,body:catalog.renderCollection(rows,slug,lang)};
    // Legacy grouped teapot link stays usable without restoring old static information.
    if(slug==='signature-teapot'&&!catalog.findProduct(rows,slug)){
      const row=rows.find(r=>r.sku==='RA-HM-001-SQ');
      if(row)return {statusCode:301,headers:{Location:catalog.languageUrl(catalog.productUrl(row),lang),'Cache-Control':'no-store'},body:''};
    }
    const row=catalog.findProduct(rows,slug);
    if(!row)return {statusCode:404,headers,body:catalog.errorPage(lang==='en'?'Product unavailable':'Producto no disponible',lang==='en'?'This product is not published. Discover available products in the shop.':'Este producto no está publicado. Descubre los productos disponibles en la tienda.',lang)};
    return {statusCode:200,headers,body:catalog.renderProduct(row,slug,lang)};
  }catch(error){
    console.error('catalog-page:',error.message);
    return {statusCode:503,headers,body:catalog.errorPage(lang==='en'?'We could not load the catalog':'No pudimos cargar el catálogo',lang==='en'?'Try again in a moment or contact info@myraices.com.':'Inténtalo de nuevo en unos momentos o escríbenos a info@myraices.com.',lang)};
  }
};
