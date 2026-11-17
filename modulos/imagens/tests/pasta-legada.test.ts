import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copiarPastaLegada } from '../../../servidor/src/pasta-legada.ts';

test('volume novo vazio recebe uma cópia da pasta antiga (sem apagar a original); com arquivos no destino não mexe', () => {
  const base = mkdtempSync(join(tmpdir(), 'legada-'));
  const antiga = join(base, 'dados', 'midia'), nova = join(base, 'arquivos', 'midia');
  mkdirSync(join(antiga, 'anexos'), { recursive: true });
  writeFileSync(join(antiga, 'foto.png'), 'png');
  writeFileSync(join(antiga, 'anexos', '1.pdf'), 'pdf');
  assert.equal(copiarPastaLegada(antiga, nova), 2);
  assert.equal(readFileSync(join(nova, 'anexos', '1.pdf'), 'utf8'), 'pdf');
  assert.equal(existsSync(join(antiga, 'foto.png')), true, 'a pasta antiga continua intacta');
  writeFileSync(join(antiga, 'nova-depois.png'), 'x');
  assert.equal(copiarPastaLegada(antiga, nova), 0, 'destino já tem arquivos: não copia de novo');
  assert.equal(existsSync(join(nova, 'nova-depois.png')), false);
  assert.equal(copiarPastaLegada(undefined, nova), 0);
  assert.equal(copiarPastaLegada(join(base, 'nao-existe'), join(base, 'outra')), 0);
  assert.equal(copiarPastaLegada(nova, nova), 0, 'mesma pasta: nada a fazer');
});
