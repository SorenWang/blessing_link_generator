import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvObjects } from '../shared/csv.mjs';

test('parseCsv supports quoted commas and escaped quotes', () => {
  const rows = parseCsv('name,message\n"林晚","愿你自由, 明亮"\n"阿宁","他说""你好"""');
  assert.deepEqual(rows, [
    ['name', 'message'],
    ['林晚', '愿你自由, 明亮'],
    ['阿宁', '他说"你好"']
  ]);
});

test('parseCsv supports newlines inside quoted fields', () => {
  const rows = parseCsv('name,message\n林晚,"第一段\n第二段"');
  assert.equal(rows[1][1], '第一段\n第二段');
});

test('parseCsvObjects lowercases headers and skips empty trailing rows', () => {
  const rows = parseCsvObjects('\uFEFFRecipient,Theme\n林晚,ivory\n\n');
  assert.deepEqual(rows, [{ recipient: '林晚', theme: 'ivory' }]);
});
