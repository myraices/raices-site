const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../js/site-content'),'utf8');
function environment(){
 let resolve,reject;const response=new Promise((a,b)=>{resolve=a;reject=b}),events={},published=[],timers=[];
 const query={select(){return this},order(){return this},abortSignal(signal){signal.addEventListener('abort',()=>reject(new Error('aborted')));return response;}};
 const window={location:{search:''},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},dispatchEvent:event=>published.push(event),raicesSupabase:{from:()=>query}};
 const document={readyState:'loading',documentElement:{classList:{add(){}}},addEventListener:(type,fn)=>events[type]=fn,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 vm.runInNewContext(code,{window,document,URLSearchParams,AbortController,CustomEvent:class{constructor(type){this.type=type}},localStorage:{getItem:()=>null},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},console:{warn(){}}});
 return {window,events,published,timers,resolve,reject};
}
test('published content is not applied or announced while its request is pending',async()=>{
 const e=environment(),loading=e.events.DOMContentLoaded();assert.equal(e.window.RAICES_CONTENT_STATUS,'loading');assert.equal(e.published.length,0);
 e.resolve({data:[{content_key:'collections_header',content:{enabled:true}}]});await loading;
 assert.equal(e.window.RAICES_CONTENT_STATUS,'ready');assert.equal((await e.window.RAICES_SITE_CONTENT_READY).status,'ready');assert.equal(e.published.length,1);
});
test('confirmed CMS failure completes the loading lifecycle and enables fallback',async()=>{
 const e=environment(),loading=e.events.DOMContentLoaded();e.reject(new Error('offline'));await loading;
 assert.equal(e.window.RAICES_CONTENT_STATUS,'fallback');assert.equal((await e.window.RAICES_SITE_CONTENT_READY).status,'fallback');assert.equal(e.published.length,1);
});
test('a stalled CMS request is aborted at the deadline rather than leaving placeholders forever',async()=>{
 const e=environment(),loading=e.events.DOMContentLoaded();const deadline=e.timers.find(t=>t.ms===8000);assert(deadline);deadline.fn();await loading;
 assert.equal(e.window.RAICES_CONTENT_STATUS,'fallback');assert.equal((await e.window.RAICES_SITE_CONTENT_READY).status,'fallback');
});
