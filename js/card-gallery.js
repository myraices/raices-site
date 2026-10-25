(function(){
  function mount(media,items,lang){
    const seen=new Set(),photos=[];
    for(const photo of items){
      if(!photo?.url)continue;
      try{const url=new URL(photo?.url,location.origin);if(!/^https?:$/.test(url.protocol)||seen.has(url.href))continue;seen.add(url.href);photos.push({...photo,url:url.href});}catch{}
    }
    if(photos.length<2)return;
    const en=lang==='en',image=media.querySelector('.product-media-img');if(!image)return;
    const track=document.createElement('div');track.className='rcg-track';track.tabIndex=0;track.setAttribute('role','group');track.setAttribute('aria-label',en?'Product photos. Swipe or use arrow keys.':'Fotos del producto. Desliza o usa las teclas de flecha.');
    photos.forEach((photo,i)=>{const img=document.createElement('img');window.RaicesImages.set(img,photo.url);img.alt=photo.alt||image.alt;img.loading='lazy';img.decoding='async';img.draggable=false;track.append(img);});
    image.replaceWith(track);media.classList.add('has-card-gallery');
    let index=0;
    const controls=document.createElement('div');controls.className='rcg-controls';
    const prev=document.createElement('button'),next=document.createElement('button'),counter=document.createElement('span');
    prev.type=next.type='button';prev.textContent='‹';next.textContent='›';prev.setAttribute('aria-label',en?'Previous photo':'Foto anterior');next.setAttribute('aria-label',en?'Next photo':'Foto siguiente');
    counter.setAttribute('aria-live','polite');counter.setAttribute('aria-atomic','true');
    const update=()=>{counter.textContent=`${index+1} / ${photos.length}`;prev.disabled=index===0;next.disabled=index===photos.length-1;};
    const go=value=>{index=Math.max(0,Math.min(photos.length-1,value));track.scrollTo({left:index*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});update();};
    prev.onclick=e=>{e.stopPropagation();go(index-1);};next.onclick=e=>{e.stopPropagation();go(index+1);};
    track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();go(index+(e.key==='ArrowRight'?1:-1));}});
    track.addEventListener('scroll',()=>{if(track.clientWidth){index=Math.max(0,Math.min(photos.length-1,Math.round(track.scrollLeft/track.clientWidth)));update();}},{passive:true});
    controls.append(prev,counter,next);media.append(controls);update();
  }
  window.RaicesCardGallery={mount};
})();
