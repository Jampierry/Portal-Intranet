import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modoAbertura, urlSegura } from '../src/links.ts';

test('computador abre em nova aba com rel seguro', () => {
  assert.deepEqual(modoAbertura(1280), { target: '_blank', rel: 'noopener noreferrer' });
});
test('celular abre na mesma aba', () => {
  assert.equal(modoAbertura(390).target, '_self');
  assert.equal(modoAbertura(860).target, '_self');
  assert.equal(modoAbertura(861).target, '_blank');
});
test('só aceita http e https', () => {
  assert.equal(urlSegura('https://meurh.dipaula.com.br/dashboard'), true);
  assert.equal(urlSegura('javascript:alert(1)'), false);
  assert.equal(urlSegura('texto solto'), false);
});
