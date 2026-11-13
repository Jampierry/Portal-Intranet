import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fatorAuto } from '../src/escala-auto.ts';

test('monitor grande não é reduzido', () => {
  assert.equal(fatorAuto(1912, 928), 1);
  assert.equal(fatorAuto(2560, 1300), 1);
});
test('monitor de 19" / notebook é reduzido pela menor proporção', () => {
  assert.equal(fatorAuto(1345, 644), 0.75);
  assert.equal(fatorAuto(1280, 900), 0.8);
});
test('nunca passa do mínimo', () => {
  assert.equal(fatorAuto(900, 300), 0.6);
});
test('celular não é reduzido', () => {
  assert.equal(fatorAuto(390, 700), 1);
  assert.equal(fatorAuto(860, 500), 1);
});
