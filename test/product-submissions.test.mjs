import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandRouter } from '../src/commands.mjs';

test('partner product flow exposes guided submit, fill, and review commands', () => {
  const router = createCommandRouter({});
  const product = router.definitions.find((command) => command.name === 'product');

  assert.ok(product, 'expected /product command');
  assert.deepEqual(
    product.options.map((option) => option.name),
    ['submit', 'fill', 'review'],
  );
});

import * as commandModule from '../src/commands.mjs';

test('guided livestock template asks only for the relevant partner fields', () => {
  assert.equal(typeof commandModule.productSubmissionTemplate, 'function');
  const template = commandModule.productSubmissionTemplate('livestock');

  assert.match(template, /Product\/strain name:/);
  assert.match(template, /Vendor price:/);
  assert.match(template, /Vendor shipping:/);
  assert.match(template, /DOA policy:/);
  assert.match(template, /Needs Aquapedia research\? yes\/no:/);
  assert.doesNotMatch(template, /Ingredients:/);
});

test('guided templates vary by chosen product type', () => {
  const eggs = commandModule.productSubmissionTemplate('eggs');
  const food = commandModule.productSubmissionTemplate('food');
  const printed = commandModule.productSubmissionTemplate('3d_printed');

  assert.match(eggs, /Egg count or pack size:/);
  assert.match(eggs, /DOA\/hatch policy:/);
  assert.match(food, /Ingredients or active contents:/);
  assert.match(food, /Storage instructions:/);
  assert.match(printed, /Material:/);
  assert.match(printed, /Dimensions:/);
  assert.doesNotMatch(printed, /DOA policy:/);
});

test('partial partner intake is preserved and reports only missing required fields', () => {
  assert.equal(typeof commandModule.parseProductSubmission, 'function');
  const result = commandModule.parseProductSubmission('livestock', [
    'Product/strain name: Blue Dream Neocaridina',
    'Quantity available: 10',
    'Vendor price: 12.00',
    'Vendor shipping: 15.00',
    'Shipping origin: Houston, TX',
    'DOA policy:',
  ].join('\n'));

  assert.equal(result.fields['product/strain name'], 'Blue Dream Neocaridina');
  assert.deepEqual(result.missing, ['DOA policy']);
});

test('guided product commands collect type, pasted details, media, and staff decision', () => {
  const product = createCommandRouter({}).definitions.find((command) => command.name === 'product');
  const byName = Object.fromEntries(product.options.map((option) => [option.name, option]));

  assert.deepEqual(byName.submit.options.map((option) => option.name), ['type']);
  assert.deepEqual(byName.fill.options.map((option) => option.name), ['submission', 'details', 'media']);
  assert.deepEqual(byName.review.options.map((option) => option.name), ['submission', 'action', 'notes']);
  assert.deepEqual(
    byName.submit.options[0].choices.map((choice) => choice.value),
    ['livestock', 'eggs', 'food', 'bacteria_water_care', '3d_printed', 'accessories', 'other'],
  );
});

test('water-care, accessories, and other products also get guided templates', () => {
  const waterCare = commandModule.productSubmissionTemplate('bacteria_water_care');
  const accessories = commandModule.productSubmissionTemplate('accessories');
  const other = commandModule.productSubmissionTemplate('other');

  assert.match(waterCare, /Product name:/);
  assert.match(waterCare, /Ingredients or active contents:/);
  assert.match(accessories, /Product name:/);
  assert.match(accessories, /Description\/specifications:/);
  assert.match(other, /Product name:/);
  assert.match(other, /Description:/);
});

test('completed livestock intake builds the same Shopify-ready pricing preview', () => {
  assert.equal(typeof commandModule.buildProductSubmissionPreview, 'function');
  const parsed = commandModule.parseProductSubmission('livestock', [
    'Product/strain name: Blue Dream Neocaridina', 'Quantity available: 10',
    'Vendor price: 12.00', 'Vendor shipping: 15.00', 'Shipping origin: Houston, TX',
    'DOA policy: 2-hour photo/video claim', 'Description / traits: Deep blue line',
    'Needs Aquapedia research? yes/no: yes',
  ].join('\n'));
  const preview = commandModule.buildProductSubmissionPreview({ ...parsed, media: [{ url: 'https://example.com/shrimp.jpg' }] }, 5);

  assert.equal(preview.product.name, 'Blue Dream Neocaridina');
  assert.equal(preview.product.category, 'live_fish');
  assert.equal(preview.product.stock, 10);
  assert.equal(preview.product.imageUrl, 'https://example.com/shrimp.jpg');
  assert.equal(preview.pricing.retailTotalCents, 2835);
  assert.equal(preview.needsAquapediaResearch, true);
});

test('every supported product type fails closed when required fields are blank', () => {
  for (const type of ['livestock', 'eggs', 'food', 'bacteria_water_care', '3d_printed', 'accessories', 'other']) {
    const parsed = commandModule.parseProductSubmission(type, '');
    assert.equal(parsed.complete, false, `${type} should not be complete when blank`);
    assert.ok(parsed.missing.length >= 4, `${type} should report required fields`);
  }
});


test('3D template keeps Shopify stock numeric and made-to-order separate', () => {
  const template = commandModule.productSubmissionTemplate('3d_printed');
  assert.match(template, /Quantity available:/);
  assert.match(template, /Made to order\? yes\/no:/);
  assert.doesNotMatch(template, /Quantity available \/ made-to-order status:/);
});

test('preview uses an image attachment for Shopify and does not mistake video for an image', () => {
  const parsed = commandModule.parseProductSubmission('other', [
    'Product name: Shrimp cave', 'Product type: accessory', 'Quantity available: 4',
    'Vendor price: 10.00', 'Vendor shipping: 5.00',
  ].join('\n'));
  const preview = commandModule.buildProductSubmissionPreview({ ...parsed, media: [
    { url: 'https://cdn.example/demo.mp4', contentType: 'video/mp4' },
    { url: 'https://cdn.example/photo.png', contentType: 'image/png' },
  ] }, 5);
  assert.equal(preview.product.imageUrl, 'https://cdn.example/photo.png');
});

test('untouched livestock template does not count the shipping-origin hint as data', () => {
  const parsed = commandModule.parseProductSubmission('livestock', commandModule.productSubmissionTemplate('livestock'));
  assert.equal(parsed.complete, false);
  assert.ok(parsed.missing.includes('Shipping origin'));
});