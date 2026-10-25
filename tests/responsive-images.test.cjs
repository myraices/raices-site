const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const images=require('../js/responsive-images');
const source='https://tqtnffinhqbyesjdollk.supabase.co/storage/v1/object/public/site-media/website/editorial.png';
test('generated image requests use a Netlify-supported fit and retain original identity',()=>{
 const widths=[160,320,480,640,960,1280,1600];
 for(const width of widths){
  const u=new URL(images.url(source,width),'https://myraices.com');
  assert.equal(u.pathname,'/.netlify/images');
  assert.equal(u.searchParams.get('fit'),'contain');
  assert.equal(u.searchParams.get('w'),String(width));
  assert.equal(images.original(u.href),source);
 }
});
function browser(){
 const requests=[];class Image{set src(value){this.address=value;requests.push(this)}}
 const window={Image,document:{addEventListener(){}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/responsive-images'),'utf8'),{window,URL,URLSearchParams,WeakMap,Map});
 return {api:window.RaicesImages,requests};
}
test('editorial keeps its working background and falls back when the image service fails',()=>{
 const {api,requests}=browser(),writes=[];
 const element={style:{setProperty:(...args)=>writes.push(args)}};
 api.background(element,source,960);assert.equal(writes.length,0);
 requests[0].onerror();assert.equal(requests[1].address,source);assert.equal(writes.length,0);
 requests[1].onload();assert.equal(writes[0][0],'background-image');assert(writes[0][1].includes(source));
});
test('an earlier image load cannot replace newer editorial content',()=>{
 const {api,requests}=browser(),writes=[];
 const element={style:{setProperty:(...args)=>writes.push(args)}};
 api.background(element,source+'?v=1');api.background(element,source+'?v=2');
 requests[0].onload();assert.equal(writes.length,0);
 requests[1].onload();assert.equal(writes.length,1);assert(writes[0][1].includes('v%3D2'));
});
