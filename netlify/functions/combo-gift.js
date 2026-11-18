const houstonDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago' });

async function loadCampaign(request, privateValidation = false, now = new Date()) {
  const [campaign] = await request('combo_gift_campaign?id=eq.1&select=*');
  const today = houstonDate.format(now);
  if (!campaign || (!privateValidation && (!campaign.active || today < campaign.starts_on || today > campaign.ends_on))) return null;
  return campaign;
}

function qualifies(campaign, items) {
  const count = skus => items.reduce((sum, item) => sum + (!item.digital && skus.includes(item.sku) ? item.qty : 0), 0);
  return Boolean(campaign && count(campaign.first_skus) >= campaign.first_qty && count(campaign.second_skus) >= campaign.second_qty);
}

function applyGift(campaign, items, choice) {
  if (!qualifies(campaign, items) || !campaign.gift_skus.includes(choice.sku)) throw new Error('GIFT_UNAVAILABLE');
  const index = items.findIndex(item => item.sku === choice.sku && item.variant === choice.variant && !item.digital);
  const item = items[index];
  if (!item || item.unitCents <= 0 || item.unitCents !== choice.cents) throw new Error('GIFT_UNAVAILABLE');
  const gift = { ...item, qty: 1, discountCents: item.unitCents, isGift: true };
  if (item.qty > 1) items[index] = { ...item, qty: item.qty - 1 };
  else items.splice(index, 1);
  items.push(gift);
  return gift;
}

module.exports = { loadCampaign, qualifies, applyGift };
