(function(){
  'use strict';
  var content={};
  var COLLECTION_MAP={collection_cocina:'Kitchen',collection_herbal:'Herbal',collection_dulces:'Desserts',collection_home:'Home',collection_wellness:'Wellness'};
  function lang(){return window.raicesLang||localStorage.getItem('raices_lang')||'es'}
  function text(item,key){if(!item)return'';var v=item[key+'_'+lang()];return v==null?(item[key+'_es']||''):v}
  function visible(el,on){if(el)el.hidden=on===false}
  function setText(root,selector,value){var el=root&&root.querySelector(selector);if(el&&value!=null)el.textContent=value}
  function safeUrl(value){return 'url("'+String(value||'').replace(/"/g,'%22')+'")'}
  function applyAnnouncement(item){if(!item)return;var bar=document.querySelector('.preopening-bar');visible(bar,item.enabled);if(!bar)return;setText(bar,'[data-i18n="preopening_text"]',text(item,'text'));var a=bar.querySelector('a');if(a){a.textContent=text(item,'link_label');if(item.link_url)a.href=item.link_url}}
  function applyHero(item){
    if(!item)return;
    var hero=document.getElementById('inicio');
    visible(hero,item.enabled);
    if(!hero)return;
    setText(hero,'[data-i18n="hero_eyebrow"]',text(item,'eyebrow'));
    setText(hero,'[data-i18n="hero_title"]',text(item,'title'));
    setText(hero,'[data-i18n="hero_text"]',text(item,'description'));
    var p=hero.querySelector('.hero-actions .btn'),s=hero.querySelector('.hero-actions .text-link');
    if(p){p.textContent=text(item,'primary_label');if(item.primary_url)p.href=item.primary_url}
    if(s){s.textContent=text(item,'secondary_label');if(item.secondary_url)s.href=item.secondary_url}

    var fallback='/assets/hero-hand-plant.webp';
    var desktop=item.image_desktop_url||item.image_mobile_url||fallback;
    var mobile=item.image_mobile_url||desktop||fallback;
    var img=document.getElementById('heroCmsImage');
    var mobileSource=document.getElementById('heroCmsMobileSource');
    var visual=document.getElementById('heroCmsVisual');
    var alt=text(item,'image_alt')||'Raíces: volver a lo esencial';

    if(mobileSource&&mobileSource.getAttribute('srcset')!==mobile)mobileSource.setAttribute('srcset',mobile);
    if(img){
      img.onerror=function(){
        img.onerror=null;
        if(mobileSource)mobileSource.setAttribute('srcset',fallback);
        img.setAttribute('src',fallback);
      };
      if(img.getAttribute('src')!==desktop&&img.src!==desktop)img.setAttribute('src',desktop);
      img.setAttribute('alt',alt);
    }
    if(visual){visual.setAttribute('aria-label',alt)}

    var position=item.content_position||'center';
    var fit=['cover','contain','soft'].indexOf(item.image_fit)>=0?item.image_fit:'cover';
    var zoom=Math.max(70,Math.min(130,Number(item.image_zoom)||100))/100;
    var posX=Math.max(0,Math.min(100,Number(item.image_position_x)==Number(item.image_position_x)?Number(item.image_position_x):50));
    var posY=Math.max(0,Math.min(100,Number(item.image_position_y)==Number(item.image_position_y)?Number(item.image_position_y):50));
    hero.dataset.cmsHeroImage=desktop;
    var overlay=Math.max(0,Math.min(80,Number(item.overlay)||0))/100;
    hero.style.setProperty('--cms-hero-overlay',overlay);
    hero.style.setProperty('--cms-hero-zoom',zoom);
    hero.style.setProperty('--cms-hero-pos-x',posX+'%');
    hero.style.setProperty('--cms-hero-pos-y',posY+'%');
    if(visual)visual.style.setProperty('--cms-hero-bg',safeUrl(desktop));
    hero.classList.remove('cms-position-left','cms-position-center','cms-position-right','cms-height-compact','cms-height-normal','cms-height-full','cms-image-fit-cover','cms-image-fit-contain','cms-image-fit-soft');
    hero.classList.add('cms-position-'+position,'cms-height-'+(item.height||'normal'),'cms-image-fit-'+fit);
  }
  function applyTrust(item){if(!item)return;var section=document.querySelector('.confidence-strip');visible(section,item.enabled);if(!section)return;var cards=section.querySelectorAll('.confidence-grid>div');for(var i=0;i<cards.length;i++){setText(cards[i],'strong',text(item,'item'+(i+1)+'_title'));setText(cards[i],'span',text(item,'item'+(i+1)+'_text'))}}
  function applyEditorial(item){if(!item)return;var section=document.querySelector('.editorial-intro');visible(section,item.enabled);if(!section)return;setText(section,'[data-i18n="editorial_eyebrow"]',text(item,'eyebrow'));setText(section,'[data-i18n="editorial_title"]',text(item,'title'));setText(section,'[data-i18n="editorial_text"]',text(item,'description'));var a=section.querySelector('.editorial-link');if(a){a.textContent=text(item,'cta_label');if(item.cta_url)a.href=item.cta_url}var imgs=section.querySelectorAll('.editorial-image');if(imgs[0]&&item.primary_image_url)imgs[0].style.backgroundImage=safeUrl(item.primary_image_url);if(imgs[1]&&item.secondary_image_url)imgs[1].style.backgroundImage=safeUrl(item.secondary_image_url);imgs.forEach(function(el){if(item.image_alt_es)el.setAttribute('aria-label',text(item,'image_alt'))});var stats=section.querySelectorAll('.editorial-proof span');if(stats[0]){setText(stats[0],'b',item.stat1_value);setText(stats[0],'small',text(item,'stat1_label'))}if(stats[1]){setText(stats[1],'b',item.stat2_value);setText(stats[1],'small',text(item,'stat2_label'))}}
  function applyCollectionsHeader(item){if(!item)return;var section=document.querySelector('.collection-doors');visible(section,item.enabled);if(!section)return;setText(section,'[data-i18n="collections_eyebrow"]',text(item,'eyebrow'));setText(section,'[data-i18n="collections_title"]',text(item,'title'));setText(section,'[data-i18n="collections_text"]',text(item,'description'))}
  function applyCollections(){Object.keys(COLLECTION_MAP).forEach(function(key){var item=content[key],cat=COLLECTION_MAP[key],target=window.RAICES_CATEGORIES&&window.RAICES_CATEGORIES[cat];if(!item||!target)return;target.cmsEnabled=item.enabled!==false;if(item.name_es)target.spanish=item.name_es;if(item.name_en)target.title=item.name_en;if(item.description_es)target.tagline=item.description_es;if(item.description_en)target.tagline_en=item.description_en;if(item.image_url)target.image=item.image_url;if(item.image_alt_es)target.imageAltEs=item.image_alt_es;if(item.image_alt_en)target.imageAltEn=item.image_alt_en;if(item.link_url)target.cmsLink=item.link_url});window.dispatchEvent(new CustomEvent('raices:siteContentUpdated'))}
  function applyNewsletter(item){if(!item)return;var section=document.querySelector('.newsletter-section');visible(section,item.enabled);if(!section)return;setText(section,'[data-i18n="community_eyebrow"]',text(item,'eyebrow'));setText(section,'[data-i18n="community_title"]',text(item,'title'));setText(section,'[data-i18n="community_text"]',text(item,'description'));setText(section,'[data-i18n="newsletter_benefit_1"]',text(item,'benefit1'));setText(section,'[data-i18n="newsletter_benefit_2"]',text(item,'benefit2'));setText(section,'[data-i18n="newsletter_benefit_3"]',text(item,'benefit3'))}
  function apply(){applyAnnouncement(content.announcement);applyHero(content.hero);applyTrust(content.trust);applyEditorial(content.editorial);applyCollectionsHeader(content.collections_header);applyCollections();applyNewsletter(content.newsletter)}
  async function load(){apply();try{var client=window.raicesSupabase;if(!client)return;var result=await client.from('site_content_public').select('content_key,content,sort_order').order('sort_order');if(result.error)throw result.error;(result.data||[]).forEach(function(row){if(row&&row.content_key&&row.content)content[row.content_key]=row.content});window.RAICES_SITE_CONTENT=content;apply()}catch(err){console.warn('[Raíces CMS] Se usará el contenido incorporado.',err&&err.message?err.message:err)}}
  window.addEventListener('raices:languageChanged',function(){if(Object.keys(content).length)apply()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
