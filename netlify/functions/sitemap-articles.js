const BASE='https://myraices.com';
const esc=s=>String(s||'').replace(/[<>&\"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','\"':'&quot;',"'":'&apos;'}[c]));

exports.handler=async()=>{
  try{
    const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co';
    const key=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW';
    const r=await fetch(`${url}/rest/v1/blog_articles_public?select=slug,published_at,updated_at&order=published_at.desc`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`}
    });
    if(!r.ok){
      const detail=await r.text().catch(()=>"");
      throw new Error(`Supabase ${r.status}${detail?` · ${detail.slice(0,240)}`:""}`);
    }
    const rows=await r.json();
    const urls=(rows||[])
      .filter(x=>x.slug)
      .map(x=>{
        const lastmod=String(x.updated_at||x.published_at||'').slice(0,10);
        return `  <url><loc>${BASE}/blog/${esc(encodeURIComponent(x.slug))}</loc>${lastmod?`<lastmod>${esc(lastmod)}</lastmod>`:''}<changefreq>monthly</changefreq><priority>0.7</priority></url>`;
      })
      .join('\n');
    return{
      statusCode:200,
      headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'},
      body:`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    };
  }catch(e){
    console.error('sitemap-articles',e);
    return{statusCode:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},body:'Sitemap temporarily unavailable'};
  }
};
