(function(){
  function safeUrl(value){try{const u=new URL(value,location.origin);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}}
  function mount(host,items,lang){
    const en=lang==='en', seen=new Set();
    const photos=items.filter(p=>p&&safeUrl(p.url)).map(p=>({...p,url:safeUrl(p.url)})).filter(p=>!seen.has(p.url)&&seen.add(p.url));
    if(!photos.length)return;
    host.replaceChildren();host.classList.add('raices-gallery');
    const main=document.createElement('button');main.type='button';main.className='rg-main';
    const image=document.createElement('img');image.decoding='async';main.append(image);host.append(main);
    const hint=document.createElement('small');hint.textContent=en?'Tap image to enlarge':'Toca la imagen para ampliar';host.append(hint);
    const thumbs=document.createElement('div');thumbs.className='rg-thumbs';thumbs.setAttribute('role','group');thumbs.setAttribute('aria-label',en?'Product photos':'Fotos del producto');host.append(thumbs);
    const select=index=>{const p=photos[index];window.RaicesImages.set(image,p.url,'(max-width:760px) 100vw, 650px',[480,640,960,1280]);image.alt=p.alt||'';main.setAttribute('aria-label',(en?'Enlarge: ':'Ampliar: ')+(p.alt||''));Array.from(thumbs.children).forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));};
    photos.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(en?'View photo ':'Ver foto ')+(i+1));const thumb=document.createElement('img');thumb.src=window.RaicesImages.url(p.url,160);thumb.alt=p.alt||'';thumb.loading='lazy';b.append(thumb);b.onclick=()=>select(i);thumbs.append(b);});
    thumbs.hidden=photos.length===1;select(0);
    main.onclick=()=>{
      const dialog=document.createElement('dialog');dialog.className='rg-dialog';dialog.setAttribute('aria-label',en?'Enlarged product image':'Imagen ampliada del producto');
      const close=document.createElement('button');close.type='button';close.textContent=en?'Close ×':'Cerrar ×';close.className='rg-close';close.onclick=()=>dialog.close();
      const full=document.createElement('img');full.src=window.RaicesImages.original(image.src);full.alt=image.alt;full.tabIndex=0;full.title=en?'Tap to zoom; scroll to read':'Toca para ampliar y desplázate para leer';
      full.onclick=()=>full.classList.toggle('rg-zoom');
      dialog.append(close,full);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();main.focus();},{once:true});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.showModal();close.focus();
    };
  }
  window.RaicesGallery={mount};
})();
