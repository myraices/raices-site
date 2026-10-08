const catalog=require('../lib/public-catalog');
exports.handler=async()=>{
  try{
    const rows=catalog.groups(await catalog.loadCatalog());
    return {statusCode:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'},body:`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(r=>`<url><loc>${catalog.esc(catalog.productUrl(r))}</loc></url>`).join('')}</urlset>`};
  }catch{return {statusCode:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},body:'Catálogo temporalmente no disponible'};}
};
