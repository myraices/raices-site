// Executes in the head, before the page is painted. Query language overrides saved preference.
(function(){
  const url=new URL(location.href),explicit=url.searchParams.get('lang');
  const rendered=document.documentElement.lang==='en'?'en':'es';
  let preferred=rendered;
  try{
    if(explicit==='en'||explicit==='es'){
      preferred=explicit;localStorage.setItem('raices_lang',explicit);localStorage.setItem('raices_lang_manual','1');
    }else preferred=localStorage.getItem('raices_lang')==='en'?'en':'es';
  }catch{if(explicit==='en'||explicit==='es')preferred=explicit;}
  if(preferred!==rendered){url.searchParams.set('lang',preferred);location.replace(url.href);return;}
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('catalogLanguageToggle');
    if(button)button.addEventListener('click',()=>{
      const next=rendered==='en'?'es':'en';
      try{localStorage.setItem('raices_lang',next);localStorage.setItem('raices_lang_manual','1');}catch{}
      const target=new URL(location.href);target.searchParams.set('lang',next);location.assign(target.href);
    });
  });
})();
