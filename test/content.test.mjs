import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMPONENTS,
  OCCASIONS,
  THEMES,
  formatChineseDate,
  normalizePage,
  safeUrl,
  toPublicPage
} from '../shared/content.mjs';

test('normalizePage fills occasion defaults and normalizes recipient text', () => {
  const page = normalizePage({ recipient: '  林晚  ', occasion: 'birthday', theme: 'night' });
  assert.equal(page.recipient, '林晚');
  assert.equal(page.title, OCCASIONS.birthday.defaultTitle('林晚'));
  assert.match(page.message, /林晚/);
  assert.equal(page.theme, 'night');
  assert.deepEqual(page.components, DEFAULT_COMPONENTS);
});

test('normalizePage falls back to safe theme and occasion values', () => {
  const page = normalizePage({ recipient: '阿宁', occasion: 'unknown', theme: 'unknown' });
  assert.equal(page.occasion, 'custom');
  assert.equal(page.theme, 'ivory');
});

test('safeUrl accepts local and https assets but rejects scripts', () => {
  assert.equal(safeUrl('/assets/images/demo-letter.svg'), '/assets/images/demo-letter.svg');
  assert.equal(safeUrl('https://example.com/image.jpg'), 'https://example.com/image.jpg');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('//example.com/image.jpg'), '');
});

test('normalizePage removes invalid gallery entries and caps content', () => {
  const page = normalizePage({
    recipient: '小满',
    gallery: [
      { url: 'javascript:alert(1)', caption: 'bad' },
      { url: '/assets/images/demo-moon.svg', caption: 'good' },
      { url: '/assets/images/demo-garden.svg' }
    ]
  });
  assert.equal(page.gallery.length, 2);
  assert.equal(page.gallery[0].caption, 'good');
});

test('normalizePage preserves publication state when editing content', () => {
  const previous = normalizePage({ recipient: '小满', status: 'published' });
  const updated = normalizePage({ recipient: '小满', message: '新的文字' }, previous);
  assert.equal(updated.status, 'published');
  assert.equal(updated.message, '新的文字');
});

test('toPublicPage does not expose internal ids or management fields', () => {
  const page = normalizePage({ recipient: '林晚', occasion: 'festival', theme: 'rose' });
  const publicPage = toPublicPage({ ...page, id: 'internal', token: 'abc123', views: 9, status: 'published' });
  assert.equal(publicPage.token, 'abc123');
  assert.equal('id' in publicPage, false);
  assert.equal('views' in publicPage, false);
  assert.equal(publicPage.occasionLabel, OCCASIONS.festival.label);
});

test('all themes are linked to a background asset', () => {
  for (const theme of Object.values(THEMES)) {
    assert.match(theme.background, /^\/assets\/backgrounds\//);
  }
});

test('formatChineseDate handles valid and invalid dates', () => {
  assert.match(formatChineseDate('2026-10-27'), /2026年10月27日/);
  assert.equal(formatChineseDate('not-a-date'), '');
  assert.equal(formatChineseDate(''), '');
});
