import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRetailBreakdown, centsToMoney, moneyToCents } from '../src/pricing.mjs';

test('5 percent markup applies to vendor price plus vendor shipping', () => {
  const result = calculateRetailBreakdown({
    vendorPriceCents: moneyToCents('100.00'),
    vendorShippingCents: moneyToCents('30.00'),
    markupPercent: 5,
  });
  assert.equal(result.vendorTotalCents, 13000);
  assert.equal(result.markupCents, 650);
  assert.equal(result.retailTotalCents, 13650);
  assert.equal(centsToMoney(result.retailTotalCents), '136.50');
});

test('money parsing preserves cents without floating point drift', () => {
  assert.equal(moneyToCents('$80'), 8000);
  assert.equal(moneyToCents('25.50'), 2550);
  assert.equal(centsToMoney(10550), '105.50');
});

test('invalid prices and markup fail closed', () => {
  assert.throws(() => moneyToCents('12.345'));
  assert.throws(() => calculateRetailBreakdown({ vendorPriceCents: 100, vendorShippingCents: 0, markupPercent: -1 }));
  assert.throws(() => calculateRetailBreakdown({ vendorPriceCents: -1, vendorShippingCents: 0, markupPercent: 5 }));
});
