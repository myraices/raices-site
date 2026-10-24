// All money is integer USD cents. Never accept prices or discount amounts from the browser.
function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error('PROMO_INVALID');
  return code;
}
function centralDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function calculatePromotion(promo, items, used = 0, now = new Date()) {
  if (!promo || promo.active !== true) throw new Error('PROMO_INVALID');
  const today = centralDate(now);
  if ((promo.starts_on && today < promo.starts_on) || (promo.ends_on && today > promo.ends_on)) throw new Error('PROMO_EXPIRED');
  if (promo.max_uses != null && used >= Number(promo.max_uses)) throw new Error('PROMO_LIMIT_REACHED');
  const lines = items.map(i => Number(i.unitCents) * Number(i.qty));
  if (!lines.length || lines.some(n=>!Number.isSafeInteger(n)||n<0)) throw new Error('EMPTY_CART');
  const subtotalCents = lines.reduce((a,b)=>a+b,0);
  if (!subtotalCents) throw new Error('EMPTY_CART');
  if (subtotalCents < Number(promo.minimum_cents || 0)) throw new Error('PROMO_MINIMUM');
  const value = Number(promo.value);
  if (!Number.isFinite(value) || value <= 0 || !['percentage','fixed'].includes(promo.discount_type) || (promo.discount_type==='percentage' && value>100)) throw new Error('PROMO_INVALID');
  const discountCents = Math.min(subtotalCents, promo.discount_type === 'percentage' ? Math.round(subtotalCents*value/100) : Math.round(value*100));
  // Largest remainder allocation preserves the exact total, including mixed tax classes.
  const allocations = lines.map(n=>Math.floor(discountCents*n/subtotalCents));
  let left = discountCents - allocations.reduce((a,b)=>a+b,0);
  const rank = lines.map((n,index)=>({index,remainder:(discountCents*n)%subtotalCents})).sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
  for (const {index} of rank) { if (!left) break; if (allocations[index]<lines[index]) {allocations[index]++;left--;} }
  return { code:promo.code, id:promo.id, updatedAt:promo.updated_at, discountCents, subtotalCents, allocations, minimumCents:Number(promo.minimum_cents||0), discountType:promo.discount_type, value };
}
async function loadPromotion(code, request) {
  const normalized = normalizeCode(code);
  let rows;
  try { rows = await request(`promotion_codes?code=eq.${encodeURIComponent(normalized)}&select=*&limit=1`); }
  catch { throw new Error('PROMO_UNAVAILABLE'); }
  const promo = rows?.[0];
  if (!promo) throw new Error('PROMO_INVALID');
  let used = 0;
  if (promo.max_uses != null) {
    try { used = Number(await request('rpc/promotion_usage_count', {method:'POST',body:JSON.stringify({p_promotion_id:promo.id,p_environment:String(process.env.SQUARE_ENVIRONMENT||'sandbox').toLowerCase()})})); }
    catch { throw new Error('PROMO_UNAVAILABLE'); }
  }
  return {promo,used};
}
function squareDiscounts(promotion) {
  if (!promotion) return [];
  return promotion.allocations.flatMap((amount,index)=>amount>0?[{uid:`PROMO-${index}`,name:promotion.code,type:'FIXED_AMOUNT',scope:'LINE_ITEM',amount_money:{amount,currency:'USD'}}]:[]);
}
module.exports = {normalizeCode,calculatePromotion,loadPromotion,squareDiscounts};

async function verifiedCustomer(event) {
  const token=String(event.headers?.authorization||event.headers?.Authorization||'').replace(/^Bearer /,'');
  if(!token)throw new Error('PROMO_LOGIN_REQUIRED');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=process.env.SUPABASE_URL||'https://tqtnffinhqbyesjdollk.supabase.co';
  if(!key)throw new Error('PROMO_UNAVAILABLE');
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
  if(!r.ok)throw new Error('PROMO_LOGIN_REQUIRED');
  const user=await r.json();
  if(!user.id||!user.email||!user.email_confirmed_at)throw new Error('PROMO_LOGIN_REQUIRED');
  return {id:user.id,email:user.email.trim().toLowerCase()};
}
async function firstPurchaseCustomer(promo,event,request) {
  if(!promo.first_purchase_only)return null;
  const user=await verifiedCustomer(event);
  const state=await request('rpc/promotion_customer_state',{method:'POST',body:JSON.stringify({p_user_id:user.id,p_email:user.email,p_environment:String(process.env.SQUARE_ENVIRONMENT||'sandbox').toLowerCase()})});
  if(!state.eligible)throw new Error('PROMO_NOT_FIRST_PURCHASE');
  if(state.pending)throw new Error('PROMO_PENDING_CHECKOUT');
  return user;
}
module.exports.verifiedCustomer=verifiedCustomer;
module.exports.firstPurchaseCustomer=firstPurchaseCustomer;
