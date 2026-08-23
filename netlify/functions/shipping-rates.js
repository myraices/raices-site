const crypto=require('crypto');
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const SHIPPO_BASE='https://api.goshippo.com';

function response(statusCode,body){return{statusCode,headers:JSON_HEADERS,body:JSON.stringify(body)}}
function safeText(v,max=500){return String(v||'').trim().slice(0,max)}
function parseSettings(v){if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch{}}return{}}
async function sb(path){
  const url=process.env.SUPABASE_URL||'https://tqtnffhqbyesjdollk.supabase.co';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  const text=await r.text();
  if(!r.ok)throw new Error(`SUPABASE_${r.status}:${text.slice(0,500)}`);
  return text?JSON.parse(text):[];
}
function isDigital(p){
  return String(p?.operational_type||'').toLowerCase()==='digital' ||
    String(p?.product_type||'').toLowerCase()==='digital' ||
    String(p?.sku||'').startsWith('RA-LB-');
}
function weightToOz(value,unit){
  const n=Number(value||0);
  if(!Number.isFinite(n)||n<=0)return 0;
  const u=String(unit||'oz').toLowerCase();
  if(u==='lb'||u==='lbs'||u==='pound'||u==='pounds')return n*16;
  if(u==='kg')return n*35.27396195;
  if(u==='g'||u==='gram'||u==='grams')return n*0.03527396195;
  return n;
}
function dimensionToIn(value,unit){
  const n=Number(value||0);
  if(!Number.isFinite(n)||n<=0)return 0;
  const u=String(unit||'in').toLowerCase();
  if(u==='cm')return n/2.54;
  if(u==='mm')return n/25.4;
  return n;
}
function parseCompanyAddress(company){
  const raw=safeText(company?.address,240);
  if(!raw)return null;
  // Supports "6407 Laguna Terra Dr, Katy, TX 77493" and "6407 Laguna Terra Dr, Katy TX 77493".
  const zipMatch=raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  const stateMatch=raw.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/i);
  if(!zipMatch||!stateMatch)return null;
  const zip=zipMatch[1],state=stateMatch[1].toUpperCase();
  const beforeState=raw.slice(0,stateMatch.index).replace(/[,\s]+$/,'').trim();
  const parts=beforeState.split(',').map(x=>x.trim()).filter(Boolean);
  if(parts.length>=2)return{street1:parts.slice(0,-1).join(', '),city:parts.at(-1),state,zip};
  const tokens=beforeState.split(/\s+/);
  if(tokens.length<3)return null;
  // Fallback cannot reliably infer a multi-word city; Katy/Houston style addresses work.
  return{street1:tokens.slice(0,-1).join(' '),city:tokens.at(-1),state,zip};
}
function resolveOrigin(company,logistics){
  const custom=String(logistics.origin_mode||'company').toLowerCase()==='custom';
  if(custom){
    return{
      name:safeText(logistics.origin_name||company.trade_name||company.legal_name||'Raíces',100),
      company:safeText(company.trade_name||company.legal_name||'Raíces',100),
      street1:safeText(logistics.origin_address1,160),
      street2:safeText(logistics.origin_address2,100),
      city:safeText(logistics.origin_city,100),
      state:safeText(logistics.origin_state,2).toUpperCase(),
      zip:safeText(logistics.origin_zip,10),
      country:'US',
      phone:safeText(logistics.origin_phone||company.phone,40),
      email:safeText(company.email||'info@myraices.com',180)
    };
  }
  const parsed=parseCompanyAddress(company)||{};
  return{
    name:safeText(logistics.origin_name||company.trade_name||company.legal_name||'Raíces',100),
    company:safeText(company.trade_name||company.legal_name||'Raíces',100),
    street1:safeText(parsed.street1||logistics.origin_address1,160),
    street2:safeText(logistics.origin_address2,100),
    city:safeText(parsed.city||logistics.origin_city,100),
    state:safeText(parsed.state||logistics.origin_state,2).toUpperCase(),
    zip:safeText(parsed.zip||logistics.origin_zip,10),
    country:'US',
    phone:safeText(company.phone||logistics.origin_phone,40),
    email:safeText(company.email||'info@myraices.com',180)
  };
}
function validAddress(a){return Boolean(a?.name&&a?.street1&&a?.city&&/^[A-Z]{2}$/.test(a?.state||'')&&/^\d{5}(?:-\d{4})?$/.test(a?.zip||'')&&a?.country)}
function quoteFingerprint(items,customer){
  const itemKey=[...items].sort((a,b)=>String(a.sku).localeCompare(String(b.sku))).map(i=>[
    String(i.sku||''),Number(i.qty||1),String(i.shipping_package_profile||''),
    Number(i.shipping_weight_value||0),String(i.shipping_weight_unit||'')
  ]);
  const destination=[
    safeText(customer.address,160).toLowerCase(),safeText(customer.apt,100).toLowerCase(),
    safeText(customer.city,100).toLowerCase(),safeText(customer.state,2).toUpperCase(),safeText(customer.zip,10)
  ];
  return crypto.createHash('sha256').update(JSON.stringify({items:itemKey,destination})).digest('hex');
}
function parcelGroups(items,profiles){
  const profileMap=new Map(profiles.filter(p=>p&&p.active!==false).map(p=>[String(p.id||p.key||p.name||''),p]));
  const groups=new Map();
  for(const item of items){
    const profileId=String(item.shipping_package_profile||'');
    const profile=profileMap.get(profileId);
    if(!profile)throw new Error(`PACKAGE_PROFILE_MISSING:${item.sku}`);
    const productWeightOz=weightToOz(item.shipping_weight_value,item.shipping_weight_unit);
    if(productWeightOz<=0)throw new Error(`PRODUCT_WEIGHT_MISSING:${item.sku}`);
    if(!groups.has(profileId))groups.set(profileId,{profile,weightOz:0,skus:[]});
    const group=groups.get(profileId);
    group.weightOz+=productWeightOz*Number(item.qty||1);
    group.skus.push(item.sku);
  }
  return [...groups.values()].map(({profile,weightOz,skus})=>{
    const emptyOz=weightToOz(profile.empty_weight,profile.weight_unit);
    const length=dimensionToIn(profile.length,profile.dimension_unit);
    const width=dimensionToIn(profile.width,profile.dimension_unit);
    const height=dimensionToIn(profile.height,profile.dimension_unit);
    if(!(length>0&&width>0&&height>0))throw new Error(`PACKAGE_DIMENSIONS_MISSING:${profile.name||'profile'}`);
    return{
      length:length.toFixed(2),width:width.toFixed(2),height:height.toFixed(2),distance_unit:'in',
      weight:Math.max(.1,weightOz+emptyOz).toFixed(2),mass_unit:'oz',
      metadata:`Raices ${safeText(profile.name,50)} · ${skus.join(',').slice(0,70)}`
    };
  });
}
async function shippo(path,options={}){
  const token=process.env.SHIPPO_API_TOKEN;
  if(!token)throw new Error('SHIPPO_TOKEN_MISSING');
  const r=await fetch(`${SHIPPO_BASE}${path}`,{
    ...options,
    headers:{Authorization:`ShippoToken ${token}`,'Content-Type':'application/json','SHIPPO-API-VERSION':'2018-02-08',...(options.headers||{})}
  });
  const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={raw:text}}
  if(!r.ok){const e=new Error('SHIPPO_REQUEST_FAILED');e.status=r.status;e.body=body;throw e}
  return body;
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return response(405,{error:'METHOD_NOT_ALLOWED'});
  try{
    const body=JSON.parse(event.body||'{}');
    const requested=Array.isArray(body.items)?body.items:[];
    const customer=body.customer||{};
    if(!requested.length)return response(400,{error:'EMPTY_CART'});
    const skus=[...new Set(requested.map(i=>safeText(i.sku,60)).filter(Boolean))];
    const rows=await sb(`products?sku=in.(${skus.map(s=>`"${s.replace(/"/g,'')}"`).join(',')})&select=id,sku,status,operational_type,product_type,shipping_enabled,shipping_package_profile,shipping_weight_value,shipping_weight_unit`);
    const bySku=new Map(rows.map(p=>[String(p.sku),p]));
    const physical=requested.map(raw=>{
      const p=bySku.get(String(raw.sku));
      if(!p)throw new Error('PRODUCT_NOT_AVAILABLE');
      return{...p,qty:Math.max(1,Math.min(99,Number(raw.qty||1)))};
    }).filter(p=>!isDigital(p));
    if(!physical.length)return response(400,{error:'NO_PHYSICAL_ITEMS'});
    if(!physical.every(p=>p.shipping_enabled===true))return response(409,{error:'SHIPPING_NOT_AVAILABLE_FOR_CART'});

    const settings=await sb('nurai_settings?section=in.(company,logistics)&select=section,settings');
    const map=Object.fromEntries(settings.map(r=>[r.section,parseSettings(r.settings)]));
    const logistics=map.logistics||{},company=map.company||{};
    if(logistics.shipping_enabled!==true)return response(409,{error:'SHIPPING_DISABLED'});

    const origin=resolveOrigin(company,logistics);
    if(!validAddress(origin))return response(409,{error:'SHIPPING_ORIGIN_INCOMPLETE'});
    const destination={
      name:safeText(customer.name,100),street1:safeText(customer.address,160),street2:safeText(customer.apt,100),
      city:safeText(customer.city,100),state:safeText(customer.state,2).toUpperCase(),zip:safeText(customer.zip,10),
      country:'US',phone:safeText(customer.phone,40),email:safeText(customer.email,180)
    };
    if(!validAddress(destination))return response(400,{error:'SHIPPING_DESTINATION_INCOMPLETE'});

    const parcels=parcelGroups(physical,Array.isArray(logistics.package_profiles)?logistics.package_profiles:[]);
    const fingerprint=quoteFingerprint(physical,{...customer,zip:destination.zip,state:destination.state});
    const shipment=await shippo('/shipments/',{method:'POST',body:JSON.stringify({
      address_from:origin,address_to:destination,parcels,async:false,
      metadata:`RQC:${fingerprint}`
    })});
    const rawRates=Array.isArray(shipment.rates)?shipment.rates:[];
    const rates=rawRates
      .filter(r=>String(r.currency||r.currency_local||'USD').toUpperCase()==='USD'&&Number(r.amount)>0)
      .map(r=>({
        id:String(r.object_id||''),shipmentId:String(r.shipment||shipment.object_id||''),
        provider:safeText(r.provider,80),service:safeText(r.servicelevel?.name||r.servicelevel?.token||'Shipping',100),
        serviceToken:safeText(r.servicelevel?.token,100),amount:Number(r.amount),currency:String(r.currency||'USD'),
        estimatedDays:Number.isFinite(Number(r.estimated_days))?Number(r.estimated_days):null,
        durationTerms:safeText(r.duration_terms,180),attributes:Array.isArray(r.attributes)?r.attributes:[],
        test:r.test===true||shipment.test===true
      }))
      .filter(r=>r.id)
      .sort((a,b)=>a.amount-b.amount)
      .slice(0,10);

    if(!rates.length)return response(422,{error:'NO_SHIPPING_RATES',messages:shipment.messages||[]});
    return response(200,{shipmentId:String(shipment.object_id||''),rates,parcels:parcels.map(p=>({length:p.length,width:p.width,height:p.height,distance_unit:p.distance_unit,weight:p.weight,mass_unit:p.mass_unit})),test:shipment.test===true});
  }catch(err){
    console.error('[shipping-rates]',err.message,err.status||'',err.body||'');
    const known=['PRODUCT_NOT_AVAILABLE','SHIPPING_NOT_AVAILABLE_FOR_CART','SHIPPING_DISABLED','SHIPPO_TOKEN_MISSING'];
    if(String(err.message).startsWith('PACKAGE_PROFILE_MISSING'))return response(409,{error:'SHIPPING_PACKAGE_PROFILE_MISSING'});
    if(String(err.message).startsWith('PRODUCT_WEIGHT_MISSING'))return response(409,{error:'SHIPPING_PRODUCT_WEIGHT_MISSING'});
    if(String(err.message).startsWith('PACKAGE_DIMENSIONS_MISSING'))return response(409,{error:'SHIPPING_PACKAGE_DIMENSIONS_MISSING'});
    if(known.includes(err.message))return response(err.message==='SHIPPO_TOKEN_MISSING'?503:409,{error:err.message});
    if(err.message==='SHIPPO_REQUEST_FAILED')return response(502,{error:'SHIPPO_RATE_REQUEST_FAILED',details:err.body||null});
    return response(500,{error:'SHIPPING_RATES_UNAVAILABLE'});
  }
};
