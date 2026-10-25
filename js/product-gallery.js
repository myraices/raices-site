document.addEventListener('DOMContentLoaded',()=>{
  const image=document.getElementById('productGalleryImage');
  if(!image||!window.RaicesGallery)return;
  const host=image.parentElement;
  const images=[{url:window.RaicesImages.original(image.src),alt:image.alt},...Array.from(host.querySelectorAll('[data-gallery-src]')).map(b=>({url:b.dataset.gallerySrc,alt:b.dataset.galleryAlt}))];
  window.RaicesGallery.mount(host,images,document.documentElement.lang);
});
