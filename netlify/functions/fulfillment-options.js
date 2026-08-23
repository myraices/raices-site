const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};

function safeText(v,max=500){return String(v||'').trim().slice(0,max);}
function parseSettings(v){if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch{}}return{};}
async function sb(path){
  const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  const t=await r.text();if(!r.ok)throw new Error(`SUPABASE_${r.status}:${t.slice(0,300)}`);
  return t?JSON.parse(t):[];
}
function isDigital(p){
  return String(p?.operational_type||'').toLowerCase()==='digital' ||
    String(p?.product_type||'').toLowerCase()==='digital' ||
    String(p?.sku||'').startsWith('RA-LB-') ||
    (String(p?.category||'').toLowerCase()==='wellness'&&String(p?.collection||'').toLowerCase()==='the library');
}
const CONTIGUOUS=new Set(['AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);
const TERRITORIES=new Set(['PR','VI','GU','AS','MP']);
function centralDateKey(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const v=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
function dateValue(v){const s=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}


function variantText(v){return String(v||'').trim().toLowerCase()}
function resolveSelectedVariant(product,requestedVariant){
  const requested=variantText(requestedVariant);
  const variants=Array.isArray(product?.variants)?product.variants:[];
  if(!requested||!variants.length)return null;
  return variants.find(v=>[
    v?.name,v?.labelEs,v?.labelEn,v?.label_es,v?.label_en,v?.label
  ].some(value=>variantText(value)===requested))||null;
}
function variantShippingConfig(product,requestedVariant){
  const variant=resolveSelectedVariant(product,requestedVariant);
  if(!variant)return{
    variant:null,
    shipping_enabled:product?.shipping_enabled===true,
    shipping_package_profile:String(product?.shipping_package_profile||''),
    shipping_weight_value:Number(product?.shipping_weight_value||0),
    shipping_weight_unit:String(product?.shipping_weight_unit||'lb')
  };
  const hasVariantFlag=variant.shippingEnabled!==undefined||variant.shipping_enabled!==undefined;
  const enabled=hasVariantFlag?Boolean(variant.shippingEnabled??variant.shipping_enabled):product?.shipping_enabled===true;
  return{
    variant,
    shipping_enabled:enabled,
    shipping_package_profile:String(variant.shippingPackageProfile||variant.shipping_package_profile||product?.shipping_package_profile||''),
    shipping_weight_value:Number(variant.shippingWeightValue??variant.shipping_weight_value??product?.shipping_weight_value??0),
    shipping_weight_unit:String(variant.shippingWeightUnit||variant.shipping_weight_unit||product?.shipping_weight_unit||'lb')
  };
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return{statusCode:405,headers:JSON_HEADERS,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
  try{
    const body=JSON.parse(event.body||'{}');
    const items=Array.isArray(body.items)?body.items:[];
    if(!items.length)return{statusCode:400,headers:JSON_HEADERS,body:JSON.stringify({error:'EMPTY_CART'})};
    const skus=[...new Set(items.map(i=>safeText(i.sku,60)).filter(Boolean))];
    const rows=await sb(`products?sku=in.(${skus.map(s=>`"${s.replace(/"/g,'')}"`).join(',')})&select=id,sku,status,operational_type,product_type,local_delivery_enabled,shipping_enabled,shipping_package_profile,shipping_weight_value,shipping_weight_unit,variants`);
    const bySku=new Map((rows||[]).map(p=>[String(p.sku),p]));
    const products=skus.map(s=>bySku.get(s)).filter(Boolean);
    if(products.length!==skus.length)return{statusCode:409,headers:JSON_HEADERS,body:JSON.stringify({error:'PRODUCT_NOT_AVAILABLE'})};

    const physical=items.map(item=>{
      const product=bySku.get(String(item.sku));
      if(!product||isDigital(product))return null;
      return{...product,_requestedVariant:item.variant||'',_shipping:variantShippingConfig(product,item.variant||'')};
    }).filter(Boolean);
    if(!physical.length)return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify({digitalOnly:true,localDeliveryEligible:false,shippingEligible:false})};

    const settingsRows=await sb('nurai_settings?section=eq.logistics&select=settings&limit=1');
    const logistics=parseSettings(settingsRows?.[0]?.settings||{});
    const profiles=Array.isArray(logistics.package_profiles)?logistics.package_profiles:[];
    const activeProfiles=new Set(profiles.filter(p=>p&&p.active!==false).map(p=>String(p.id||p.key||p.name||'')).filter(Boolean));

    const localDeliveryEligible=physical.every(p=>p.local_delivery_enabled!==false);
    const shippingFlagEligible=physical.every(p=>p._shipping?.shipping_enabled===true);
    const setupProblems=[];
    physical.forEach(p=>{
      const shipping=p._shipping||{};
      if(shipping.shipping_enabled!==true)return;
      if(!(Number(shipping.shipping_weight_value)>0))setupProblems.push({sku:p.sku,variant:p._requestedVariant||null,reason:'MISSING_WEIGHT'});
      const profile=String(shipping.shipping_package_profile||'');
      if(!profile)setupProblems.push({sku:p.sku,variant:p._requestedVariant||null,reason:'MISSING_PACKAGE_PROFILE'});
      else if(!activeProfiles.has(profile)) setupProblems.push({sku:p.sku,variant:p._requestedVariant||null,reason:'PACKAGE_PROFILE_INACTIVE'});
    });
    const shippingConfigured=logistics.shipping_enabled===true;
    const shippingEligible=shippingConfigured&&shippingFlagEligible&&setupProblems.length===0;
    const environment=String(process.env.SQUARE_ENVIRONMENT||'sandbox').toLowerCase();
    const freeShippingEnabled=logistics.free_shipping_enabled===true;
    const freeShippingStart=dateValue(logistics.free_shipping_start_date);
    const freeShippingEnd=dateValue(logistics.free_shipping_end_date);
    const today=centralDateKey();
    const freeShippingActive=freeShippingEnabled&&(!freeShippingStart||today>=freeShippingStart)&&(!freeShippingEnd||today<=freeShippingEnd);
    const freeShippingThreshold=Math.max(0,Number(logistics.free_shipping_threshold||0));

    const allowedStates=[];
    if(logistics.allow_contiguous_us!==false)allowedStates.push(...CONTIGUOUS);
    if(logistics.allow_alaska===true)allowedStates.push('AK');
    if(logistics.allow_hawaii===true)allowedStates.push('HI');
    if(logistics.allow_territories===true)allowedStates.push(...TERRITORIES);

    return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify({
      digitalOnly:false,
      localDeliveryEligible,
      shippingEnabled:shippingConfigured,
      shippingEligible,
      shippingFlagEligible,
      shippingSetupProblems:setupProblems,
      shippingProvider:String(logistics.shipping_provider||'shippo'),
      allowedStates:[...new Set(allowedStates)],
      environment,
      shippingRateMode:'shippo',
      freeShipping:{enabled:freeShippingEnabled,active:freeShippingActive,threshold:freeShippingThreshold,startDate:freeShippingStart,endDate:freeShippingEnd}
    })};
  }catch(e){
    console.error('fulfillment-options',e);
    return{statusCode:500,headers:JSON_HEADERS,body:JSON.stringify({error:'FULFILLMENT_OPTIONS_UNAVAILABLE'})};
  }
};
