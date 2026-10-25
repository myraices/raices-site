/* Shared by browser templates and server-rendered catalog pages. */
(function(root){
  const origin='https://myraices.com';
  const storage='https://tqtnffinhqbyesjdollk.supabase.co';
  function original(value){
    try { const u=new URL(value,origin);return u.pathname==='/.netlify/images'?u.searchParams.get('url')||value:value; }catch{return value;}
  }
  function url(value,width=640){
    if(!value)return '';
    const source=original(value);
    try {
      const u=new URL(source,origin);
      const remote=u.origin===storage && /^\/storage\/v1\/object\/public\/(product-images|site-media|blog-media)\//.test(u.pathname);
      const local=u.origin===origin && u.pathname.startsWith('/assets/');
      if(!remote&&!local)return source;
      return '/.netlify/images?'+new URLSearchParams({url:local?u.pathname: u.href,w:String(width),fit:'inside',q:'82',fm:'webp'});
    }catch{return source;}
  }
  function srcset(value,widths=[320,480,640,960]){
    return url(value)===original(value)?'':widths.map(w=>url(value,w)+' '+w+'w').join(', ');
  }
  function attrs(value,sizes='(max-width:760px) 46vw, (max-width:1100px) 45vw, 320px',widths){
    const escape=v=>String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return 'src="'+escape(url(value))+'" srcset="'+escape(srcset(value,widths))+'" sizes="'+escape(sizes)+'"';
  }
  function set(image,value,sizes,widths){
    image.sizes=sizes||'(max-width:760px) 46vw, 320px';
    image.srcset=srcset(value,widths); image.src=url(value);
  }
  const api={url,srcset,attrs,set,original};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root.document){
    root.RaicesImages=api;
    // Restore the original if a transform is unavailable, including SSR images.
    root.document.addEventListener('error',event=>{
      const img=event.target;
      if(img.tagName!=='IMG')return;
      const failed=img.currentSrc||img.src;
      const source=original(failed);
      if(source===failed)return;
      const picture=img.closest('picture');
      picture?.querySelectorAll('source').forEach(s=>s.removeAttribute('srcset'));
      img.removeAttribute('srcset');img.src=source;
    },true);
  }
})(typeof window==='undefined'?globalThis:window);
