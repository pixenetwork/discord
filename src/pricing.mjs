export function moneyToCents(value) {
  const text = String(value ?? '').trim().replace(/^\$/, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error(`Invalid money value: ${value}`);
  }
  const [whole, fraction = ''] = text.split('.');
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0') || '0', 10);
}

export function centsToMoney(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Money cents must be a non-negative safe integer');
  return (cents / 100).toFixed(2);
}

export function calculateRetailBreakdown({ vendorPriceCents, vendorShippingCents, markupPercent = 5 }) {
  for (const [label, value] of Object.entries({ vendorPriceCents, vendorShippingCents })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  }
  if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 100) {
    throw new Error('markupPercent must be between 0 and 100');
  }

  const vendorTotalCents = vendorPriceCents + vendorShippingCents;
  const markupCents = Math.round((vendorTotalCents * markupPercent) / 100);
  const retailTotalCents = vendorTotalCents + markupCents;

  return Object.freeze({
    vendorPriceCents,
    vendorShippingCents,
    vendorTotalCents,
    markupPercent,
    markupCents,
    retailTotalCents,
  });
}

export function resolveMarkupPercent(category, defaultPercent, overrides = {}) {
  const normalized = String(category ?? '').trim().toLowerCase();
  const candidate = overrides[normalized];
  const percent = candidate == null ? defaultPercent : Number(candidate);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error(`Invalid markup for category ${category}`);
  return percent;
}
