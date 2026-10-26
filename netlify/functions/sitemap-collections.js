const catalog=require('../lib/public-catalog');
exports.handler=async()=>{
  try{
    const rows=await catalog.loadCatalog();
    const published=new Set(rows.map(catalog.category));
    const urls=Object.keys(catalog.categories).filter(slug=>published.has(slug)).flatMap(slug=>['es','en'].map(lang=>catalog.languageUrl(`${catalog.BASE}/collections/${slug}/`,lang)));
    return {statusCode:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'},body:`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${catalog.esc(url)}</loc></url>`).join('')}</urlset>`};
  }catch{return {statusCode:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},body:'Colecciones temporalmente no disponibles'};}
};
