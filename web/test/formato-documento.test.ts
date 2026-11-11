import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatoPorNome } from '../src/gestao/formatoDocumento.ts';

test('formato do documento pela extensão do arquivo ou do link', () => {
  assert.equal(formatoPorNome('politica.PDF'), 'PDF');
  assert.equal(formatoPorNome('RH/escala-2026.xlsx'), 'Planilha');
  assert.equal(formatoPorNome('https://x.com/a/manual.docx?download=1'), 'Documento Word');
  assert.equal(formatoPorNome('apresentacao.pptx'), 'Apresentação');
  assert.equal(formatoPorNome('arquivo.xyz'), 'XYZ');
  assert.equal(formatoPorNome('https://sistema.com/documento'), null);
});
