import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageObject, randomToken } from '../server.js';

test('randomToken creates URL-safe opaque tokens', () => {
  const token = randomToken();
  assert.equal(token.length, 10);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test('createPageObject generates independent ids and stable page fields', () => {
  const first = createPageObject({ recipient: '林晚', occasion: 'birthday' });
  const second = createPageObject({ recipient: '林晚', occasion: 'birthday' });
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.token, second.token);
  assert.equal(first.status, 'draft');
  assert.equal(first.views, 0);
  assert.equal(first.recipient, '林晚');
});
