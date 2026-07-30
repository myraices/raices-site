(function(){
  'use strict';
  const B=window.RaicesBlog;
  const state={articles:[],filter:'all',signature:''};
  const signature=list=>JSON.stringify((list||[]).map(a=>[a.id,a.slug,a.published_at,a.title_es,a.excerpt_es,a.featured,a.view_count]));
  const $=s=>document.querySelector(s);
  function text(a,key){return B.localized(a,key)}
  function card(a,lead=false){return `<article class="blog-card ${lead?'blog-card--lead':''}" data-category="${B.escape(text(a,'category_name').toLowerCase())}">
    <a class="blog-card-image-wrap" href="${B.articleUrl(a)}"><img class="blog-card-image" src="${B.escape(B.image(a))}" alt="${B.escape(text(a,'title'))}" loading="lazy"></a>
    <div class="blog-card-body"><span class="blog-chip">${B.escape(text(a,'category_name')||'Bienestar')}</span>
    <h${lead?'2':'3'}><a href="${B.articleUrl(a)}" style="color:inherit;text-decoration:none">${B.escape(text(a,'title'))}</a></h${lead?'2':'3'}>
    <p>${B.escape(text(a,'excerpt'))}</p><div class="blog-card-meta"><span>${B.escape(a.author_name||'Equipo My Raíces')} · ${B.date(a.published_at)}</span><a class="blog-read-more" href="${B.articleUrl(a)}">Leer más →</a></div></div></article>`}
  function render(){
    const list=state.filter==='all'?state.articles:state.articles.filter(a=>(text(a,'category_name')||'').toLowerCase()===state.filter);
    const featured=list.filter(a=>a.featured).slice(0,3);const chosen=(featured.length?featured:list).slice(0,3);const recent=list.filter(a=>!chosen.includes(a)).slice(0,6);
    $('#featuredArticles').innerHTML=chosen.length?`${card(chosen[0],true)}<div class="blog-featured-secondary">${chosen.slice(1).map(a=>card(a)).join('')}</div>`:'<div class="blog-empty">No hay artículos en esta categoría todavía.</div>';
    $('#recentArticles').innerHTML=recent.length?recent.map(a=>card(a)).join(''):'<div class="blog-empty">Próximamente publicaremos más contenido.</div>';
    $('#popularArticles').innerHTML=state.articles.slice(0,4).map(a=>`<a class="blog-popular-item" href="${B.articleUrl(a)}"><img src="${B.escape(B.image(a))}" alt=""><span><strong>${B.escape(text(a,'title'))}</strong><span>${B.date(a.published_at)}</span></span></a>`).join('');
  }
  function categories(){const names=[...new Set(state.articles.map(a=>text(a,'category_name')).filter(Boolean))];const holder=$('#blogFilters');holder.innerHTML=`<button class="blog-filter active" data-filter="all">Todos</button>${names.map(n=>`<button class="blog-filter" data-filter="${B.escape(n.toLowerCase())}">${B.escape(n)}</button>`).join('')}`;holder.addEventListener('click',e=>{const btn=e.target.closest('[data-filter]');if(!btn)return;state.filter=btn.dataset.filter;holder.querySelectorAll('.blog-filter').forEach(x=>x.classList.toggle('active',x===btn));render();});}
  async function subscribe(e){e.preventDefault();const form=e.currentTarget,msg=form.querySelector('.blog-subscribe-message'),email=form.email.value.trim();msg.dataset.state='';msg.textContent='Enviando...';try{const res=await fetch('/.netlify/functions/save-interest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,name:'Lector del Blog',source:'blog_newsletter',consent:true,language:B.lang()})});if(!res.ok)throw new Error();form.reset();msg.dataset.state='ok';msg.textContent='Gracias. Ya formas parte de la comunidad Raíces.';}catch{msg.dataset.state='error';msg.textContent='No pudimos guardar tu correo. Intenta de nuevo.';}}
  document.addEventListener('DOMContentLoaded',async()=>{
    const refresh=async(initial=false)=>{
      const articles=await B.articles();
      const next=signature(articles);
      if(initial||next!==state.signature){state.articles=articles;state.signature=next;categories();render();}
    };
    await refresh(true);
    $('#blogSubscribe')?.addEventListener('submit',subscribe);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},30000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(false)});
    window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  });
})();
