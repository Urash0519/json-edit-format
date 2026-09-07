import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDocument, saveDocument } from '../src/storage.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
test('restores exact drafts including invalid JSON, independently per browser and side', () => {
  const first = memoryStorage(), second = memoryStorage();
  const draft = '{"id":900719925474099312345,"未完成":\n';
  assert.equal(saveDocument(first, 'left', draft), true);
  saveDocument(first, 'right', 'null');
  assert.equal(loadDocument(first, 'left').text, draft);
  assert.equal(loadDocument(first, 'right').text, 'null');
  assert.equal(loadDocument(second, 'left').text, '');
  saveDocument(first, 'left', '');
  assert.equal(loadDocument(first, 'left').text, '');
  assert.equal(loadDocument(first, 'right').text, 'null');
});
test('storage failure reports failure without deleting the previous successful draft', () => {
  const storage = memoryStorage();
  saveDocument(storage, 'left', 'previous');
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(saveDocument(storage, 'left', 'new'), false);
  assert.equal(loadDocument(storage, 'left').text, 'previous');
  assert.equal(loadDocument(undefined, 'left').ok, false);
  assert.equal(saveDocument(undefined, 'left', 'new'), false);
});
