import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, transform, compare } from '../src/json.js';
test('strict validation catches common errors and duplicates', () => {
  for (const value of ['{"x":1,}', '{"x" 1}', '{x:1}', '{"x":1 // comment\n}', '{"x":1,"x":2}', '', '[01]', 'true false']) assert.ok(inspect(value).issues.length, value);
  for (const value of ['null', '42', '[]', '{"x":"文字"}', '[true,false,null]']) assert.equal(inspect(value).issues.length, 0);
});
test('format and compact retain exact numeric literals and string whitespace', () => {
  const original = '{"id":900719925474099312345,"n":1.234567890123456789,"huge":1e999,"s":" a b ","nested":[1,2]}';
  const formatted = transform(original, 4);
  assert.ok(formatted.includes('\n    "id"'));
  assert.equal(transform(formatted, 2, true), original);
  assert.throws(() => transform('{broken}'));
});
test('comparison ignores object order and equivalent decimal forms', () => {
  assert.deepEqual(compare('{"b":1e3,"a":[-0,1.00]}', '{"a":[0,1],"b":1000}'), []);
  assert.equal(compare('9007199254740992', '9007199254740993').length, 1);
  assert.equal(compare('1e999', '2e999').length, 1);
});
test('reports additions removals types array order and escaped paths', () => {
  const result = compare('{"a/b~c":1,"gone":false,"arr":[1,2]}', '{"a/b~c":"1","new":null,"arr":[2,1]}');
  assert.equal(result.length, 5);
  assert.equal(result[0].path, '/a~1b~0c');
  assert.equal(result[1].kind, 'removed');
  assert.equal(result.at(-1).kind, 'added');
  assert.equal(compare('{"__proto__":1}', '{"__proto__":2}').length, 1);
  assert.throws(() => compare('{"x":1,"x":2}', '{}'));
});
