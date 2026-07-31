(function(){
  'use strict';
  var content = {};
  var COLLECTION_MAP = {
    collection_cocina:'Kitchen', collection_herbal:'Herbal', collection_dulces:'Desserts',
    collection_home:'Home', collection_wellness:'Wellness'
  };
  function lang(){ return window.raicesLang || localStorage.getItem('raices_lang') || 'es'; }
  function text(item, key){
    if(!item) return '';
    var localized = item[key + '_' + lang()];
    return localized == null ? (item[key + '_es'] || '') : localized;
  }
  function setVisible(el, enabled){ if(el) el.hidden = enabled === false; }
  function applyAnnouncement(item){
    if(!item) return;
    var bar=document.querySelector('.preopening-bar'); setVisible(bar,item.enabled);
    if(!bar) return;
    var message=bar.querySelector('[data-i18n="preopening_text"]');
    var link=bar.querySelector('a');
    if(message) message.textContent=text(item,'text');
    if(link){ link.textContent=text(item,'link_label'); if(item.link_url) link.href=item.link_url; }
  }
  function applyHero(item){
    if(!item) return;
    var hero=document.getElementById('inicio'); setVisible(hero,item.enabled);
    if(!hero) return;
    var eyebrow=hero.querySelector('[data-i18n="hero_eyebrow"]');
    var title=hero.querySelector('[data-i18n="hero_title"]');
    var description=hero.querySelector('[data-i18n="hero_text"]');
    var primary=hero.querySelector('.hero-actions .btn');
    var secondary=hero.querySelector('.hero-actions .text-link');
    if(eyebrow) eyebrow.textContent=text(item,'eyebrow');
    if(title) title.textContent=text(item,'title');
    if(description) description.textContent=text(item,'description');
    if(primary){ primary.textContent=text(item,'primary_label'); if(item.primary_url) primary.href=item.primary_url; }
    if(secondary){ secondary.textContent=text(item,'secondary_label'); if(item.secondary_url) secondary.href=item.secondary_url; }
    var art=hero.querySelector('.hero-art');
    var image=(window.matchMedia && window.matchMedia('(max-width: 700px)').matches && item.image_mobile_url) || item.image_desktop_url;
    if(image){ var safe=String(image).replace(/"/g,'%22'); hero.style.setProperty('--cms-hero-image','url("'+safe+'")'); if(art) art.style.backgroundImage='url("'+safe+'")'; }
    hero.style.setProperty('--cms-hero-overlay', Math.max(0,Math.min(80,Number(item.overlay)||0))/100);
    hero.classList.remove('cms-position-left','cms-position-center','cms-position-right','cms-height-compact','cms-height-normal','cms-height-full');
    hero.classList.add('cms-position-'+(item.content_position||'left'),'cms-height-'+(item.height||'compact'));
  }
  function applyCollections(){
    Object.keys(COLLECTION_MAP).forEach(function(key){
      var item=content[key], cat=COLLECTION_MAP[key], target=window.RAICES_CATEGORIES && window.RAICES_CATEGORIES[cat];
      if(!item || !target) return;
      target.cmsEnabled=item.enabled!==false;
      if(item.name_es) target.spanish=item.name_es;
      if(item.name_en) target.title=item.name_en;
      if(item.description_es) target.tagline=item.description_es;
      if(item.description_en) target.tagline_en=item.description_en;
      if(item.image_url) target.image=item.image_url;
      if(item.link_url) target.cmsLink=item.link_url;
    });
    window.dispatchEvent(new CustomEvent('raices:siteContentUpdated'));
  }
  function apply(){ applyAnnouncement(content.announcement); applyHero(content.hero); applyCollections(); }
  async function load(){
    try{
      var client=window.raicesSupabase;
      if(!client) return;
      var result=await client.from('site_content_public').select('content_key,content,sort_order').order('sort_order');
      if(result.error) throw result.error;
      (result.data||[]).forEach(function(row){ if(row && row.content_key && row.content) content[row.content_key]=row.content; });
      window.RAICES_SITE_CONTENT=content;
      apply();
    }catch(err){ console.warn('[Raíces CMS] Se usará el contenido incorporado.',err && err.message ? err.message : err); }
  }
  window.addEventListener('raices:languageChanged',function(){ if(Object.keys(content).length) apply(); });
  window.addEventListener('resize',function(){ if(content.hero) applyHero(content.hero); },{passive:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true}); else load();
})();
