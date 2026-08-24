function clean(value, max = 200) { return String(value || '').trim().slice(0, max); }

function normalizeState(value) {
  const raw = clean(value, 40).toUpperCase();
  const aliases = {
    TEXAS: 'TX', FLORIDA: 'FL', CALIFORNIA: 'CA', 'NEW YORK': 'NY',
    ARIZONA: 'AZ', COLORADO: 'CO', GEORGIA: 'GA', ILLINOIS: 'IL',
    LOUISIANA: 'LA', NEVADA: 'NV', OKLAHOMA: 'OK', TENNESSEE: 'TN'
  };
  return /^[A-Z]{2}$/.test(raw) ? raw : (aliases[raw] || raw);
}

function normalizeSalesTax(input) {
  const config = input && typeof input === 'object' ? input : {};
  const states = Array.isArray(config.states) ? config.states : [];
  return {
    mode: String(config.mode || 'manual_by_state'),
    taxDeliveryWhenTaxable: config.tax_delivery_when_taxable !== false,
    states: states.map(rule => ({
      country: String(rule?.country || 'US').toUpperCase(),
      state: normalizeState(rule?.state),
      name: clean(rule?.name || rule?.state, 80),
      rate: Number(rule?.rate || 0),
      stateRate: Number(rule?.state_rate || 0),
      nexus: rule?.nexus !== false,
      active: rule?.active !== false,
      sourceNote: clean(rule?.source_note || '', 240)
    })).filter(rule => /^[A-Z]{2}$/.test(rule.state) && Number.isFinite(rule.rate) && rule.rate >= 0)
  };
}
function zeroTaxResult({state,provider='manual-no-nexus',ruleName=null,nexus=false,reason='NO_NEXUS'}) {
  return {provider,taxCents:0,ratePercent:0,freightTaxable:false,taxableAmountCents:0,state,ruleName,nexus,reason};
}
function calculateManualTax({ customer, items, deliveryCents, salesTax }) {
  const state = normalizeState(customer?.state);
  const taxableItems = (items || []).filter(item => item.taxStatus === 'physical_taxable' || item.taxStatus === 'digital_taxable');
  const taxablePhysical = taxableItems.filter(item => item.taxStatus === 'physical_taxable');
  if (!taxableItems.length) return zeroTaxResult({state,provider:'manual-exempt',reason:'NO_TAXABLE_ITEMS'});
  const config = normalizeSalesTax(salesTax);
  const rule = config.states.find(row => row.country === 'US' && row.state === state);
  if (!rule) return zeroTaxResult({state,reason:'STATE_NOT_CONFIGURED'});
  if (!rule.nexus) return zeroTaxResult({state,ruleName:rule.name||state,reason:'NEXUS_INACTIVE'});
  if (!rule.active) return zeroTaxResult({state,ruleName:rule.name||state,nexus:true,reason:'COLLECTION_INACTIVE'});
  const itemsTaxableCents = taxableItems.reduce((sum,item)=>sum+Number(item.unitCents||0)*Number(item.qty||0),0);
  const freightTaxable = config.taxDeliveryWhenTaxable && taxablePhysical.length>0 && Number(deliveryCents||0)>0;
  const taxableAmountCents = itemsTaxableCents + (freightTaxable?Number(deliveryCents||0):0);
  const taxCents = Math.round(taxableAmountCents*Number(rule.rate)/100);
  return {provider:'manual-state-nexus',taxCents,ratePercent:Number(rule.rate),freightTaxable,taxableAmountCents,state,ruleName:rule.name||state,nexus:true,stateRatePercent:Number(rule.stateRate||0),sourceNote:rule.sourceNote||''};
}

module.exports = { calculateManualTax, normalizeSalesTax };
