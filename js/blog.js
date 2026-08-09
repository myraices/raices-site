(function(){
  'use strict';
  const B=window.RaicesBlog;
  const state={articles:[],filter:'all',signature:'',hero:null};
  const signature=list=>JSON.stringify((list||[]).map(a=>[a.id,a.slug,a.published_at,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.featured,a.view_count]));
  const $=s=>document.querySelector(s);
  function text(a,key){return B.localized(a,key)}
  function applyHero(){const h=state.hero;if(!h)return;const lang=B.lang(),pick=k=>h[`${k}_${lang}`]||h[`${k}_es`]||'';const kicker=$('#blogHeroKicker'),title=$('#blogHeroTitle'),textEl=$('#blogHeroText'),btn=$('#blogHeroButton'),art=$('#blogHeroArt');if(kicker)kicker.textContent=pick('kicker');if(title)title.textContent=pick('title');if(textEl)textEl.textContent=pick('description');if(btn){btn.textContent=pick('button_label')||(lang==='en'?'Explore articles':'Explorar artículos');btn.setAttribute('href',h.button_url||'#articulos')}if(art&&h.image_url){art.style.backgroundImage=`url("${String(h.image_url).replace(/"/g,'')}")`;art.setAttribute('aria-label',pick('image_alt')||pick('title'))}}
  function card(a,lead=false){return `<article class="blog-card ${lead?'blog-card--lead':''}" data-category="${B.escape(text(a,'category_name').toLowerCase())}">
    <a class="blog-card-image-wrap" href="${B.articleUrl(a)}"><img class="blog-card-image" src="${B.escape(B.image(a))}" alt="${B.escape(text(a,'title'))}" loading="lazy"></a>
    <div class="blog-card-body"><span class="blog-chip">${B.escape(text(a,'category_name')||'Bienestar')}</span>
    <h${lead?'2':'3'}><a href="${B.articleUrl(a)}" style="color:inherit;text-decoration:none">${B.escape(text(a,'title'))}</a></h${lead?'2':'3'}>
    <p>${B.escape(text(a,'excerpt'))}</p><div class="blog-card-meta"><span>${B.escape(a.author_name||'Equipo My Raíces')} · ${B.date(a.published_at)}</span><a class="blog-read-more" href="${B.articleUrl(a)}">${B.lang()==='en'?'Read more':'Leer más'} →</a></div></div></article>`}
  function render(){
    const list=state.filter==='all'?state.articles:state.articles.filter(a=>(text(a,'category_name')||'').toLowerCase()===state.filter);
    const featured=list.filter(a=>a.featured).slice(0,3);const chosen=(featured.length?featured:list).slice(0,3);const recent=list.filter(a=>!chosen.includes(a)).slice(0,6);
    $('#featuredArticles').innerHTML=chosen.length?`${card(chosen[0],true)}<div class="blog-featured-secondary">${chosen.slice(1).map(a=>card(a)).join('')}</div>`:`<div class="blog-empty">${B.lang()==='en'?'There are no articles in this category yet.':'No hay artículos en esta categoría todavía.'}</div>`;
    $('#recentArticles').innerHTML=recent.length?recent.map(a=>card(a)).join(''):`<div class="blog-empty">${B.lang()==='en'?'More content is coming soon.':'Próximamente publicaremos más contenido.'}</div>`;
    $('#popularArticles').innerHTML=state.articles.slice(0,4).map(a=>`<a class="blog-popular-item" href="${B.articleUrl(a)}"><img src="${B.escape(B.image(a))}" alt=""><span><strong>${B.escape(text(a,'title'))}</strong><span>${B.date(a.published_at)}</span></span></a>`).join('');
  }
  function categories(){const names=[...new Set(state.articles.map(a=>text(a,'category_name')).filter(Boolean))];const holder=$('#blogFilters');holder.innerHTML=`<button class="blog-filter active" data-filter="all">${B.lang()==='en'?'All':'Todos'}</button>${names.map(n=>`<button class="blog-filter" data-filter="${B.escape(n.toLowerCase())}">${B.escape(n)}</button>`).join('')}`;holder.onclick=e=>{const btn=e.target.closest('[data-filter]');if(!btn)return;state.filter=btn.dataset.filter;holder.querySelectorAll('.blog-filter').forEach(x=>x.classList.toggle('active',x===btn));render();};}
  let newsletterTurnstileWidgetId=null,newsletterTurnstileToken='';
  function consentCopy(){const el=$('#blogConsentText');if(el)el.textContent=B.lang()==='en'?'I want to receive Raíces content, recipes, news, products and promotions by email. I can unsubscribe at any time.':'Quiero recibir por email contenido, recetas, novedades, productos y promociones de Raíces. Puedo cancelar mi suscripción en cualquier momento.';}
  async function renderNewsletterTurnstile(){if(newsletterTurnstileWidgetId!==null)return;const sitekey=window.RAICES_TURNSTILE_SITE_KEY;if(!sitekey||String(sitekey).includes('__TURNSTILE'))return;for(let i=0;i<40&&!(window.turnstile&&typeof window.turnstile.render==='function');i++)await new Promise(r=>setTimeout(r,150));if(!(window.turnstile&&typeof window.turnstile.render==='function'))return;newsletterTurnstileWidgetId=window.turnstile.render('#blogNewsletterTurnstile',{sitekey,action:'newsletter',callback:token=>{newsletterTurnstileToken=token;},'expired-callback':()=>{newsletterTurnstileToken='';},'error-callback':()=>{newsletterTurnstileToken='';}});}
  async function subscribe(e){e.preventDefault();const form=e.currentTarget,msg=form.querySelector('.blog-subscribe-message'),email=form.email.value.trim(),consent=Boolean(form.marketingConsent&&form.marketingConsent.checked),honeypot=form.website?form.website.value:'';msg.dataset.state='';if(!consent){msg.dataset.state='error';msg.textContent=B.lang()==='en'?'Please confirm that you want to receive Raíces emails.':'Confirma que deseas recibir los emails de Raíces.';return;}if(!newsletterTurnstileToken){msg.dataset.state='error';msg.textContent=B.lang()==='en'?'Complete the security verification.':'Completa la verificación de seguridad.';return;}msg.textContent=B.lang()==='en'?'Sending...':'Enviando...';try{const res=await fetch('/.netlify/functions/save-interest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,name:'',source:'blog_newsletter',consent:true,language:B.lang(),turnstile_token:newsletterTurnstileToken,honeypot})});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.message||'Subscription failed');form.reset();newsletterTurnstileToken='';if(newsletterTurnstileWidgetId!==null&&window.turnstile)window.turnstile.reset(newsletterTurnstileWidgetId);msg.dataset.state='ok';msg.textContent=B.lang()==='en'?'Thank you. You are now part of the Raíces community.':'Gracias. Ya formas parte de la comunidad Raíces.';}catch(err){console.warn('Blog subscription:',err);msg.dataset.state='error';msg.textContent=B.lang()==='en'?'We could not save your email. Please try again.':'No pudimos guardar tu correo. Intenta de nuevo.';}}
  document.addEventListener('DOMContentLoaded',async()=>{
    const refresh=async(initial=false)=>{
      const articles=await B.articles();
      const next=signature(articles);
      if(initial||next!==state.signature){state.articles=articles;state.signature=next;categories();render();}
    };
    state.hero=await B.home();applyHero();
    await refresh(true);
    consentCopy();renderNewsletterTurnstile().catch(()=>{});$('#blogSubscribe')?.addEventListener('submit',subscribe);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},30000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(false)});
    window.addEventListener('raices:languageChanged',()=>{state.filter='all';applyHero();categories();render();consentCopy();});
    window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  });
})();
