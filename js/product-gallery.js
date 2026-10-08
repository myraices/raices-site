document.addEventListener('click',event=>{
  const button=event.target.closest('[data-gallery-src]');
  const image=document.getElementById('productGalleryImage');
  if(!button||!image)return;
  image.src=button.dataset.gallerySrc;image.alt=button.dataset.galleryAlt||'';
  document.querySelectorAll('[data-gallery-src]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
