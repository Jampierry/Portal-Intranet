// Visualizador de arquivos dentro do portal: Word, texto, PDF e formato sem pré-visualização; maximizar, imprimir e baixar.
import { test, expect } from '@playwright/test';
import { crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADMIN, apiComo, entrar, unico } from './ajuda.ts';

test.use({ viewport: { width: 1366, height: 768 } });
const PASTA = resolve(import.meta.dirname, '..', 'dados-privados', 'e2e', 'documentos');

/** .docx mínimo (zip sem compressão) com um parágrafo. */
function docx(texto: string): Buffer {
  const arquivos: [string, string][] = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${texto}</w:t></w:r></w:p></w:body></w:document>`],
  ];
  const locais: Buffer[] = [], central: Buffer[] = []; let deslocamento = 0;
  for (const [nome, conteudo] of arquivos) {
    const n = Buffer.from(nome), d = Buffer.from(conteudo), c = crc32(d);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(c, 14); local.writeUInt32LE(d.length, 18); local.writeUInt32LE(d.length, 22); local.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt32LE(c, 16); cen.writeUInt32LE(d.length, 20); cen.writeUInt32LE(d.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(deslocamento, 42);
    locais.push(local, n, d); central.push(cen, n); deslocamento += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(central), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10); fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, cd, fim]);
}
const PDF = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

test('abre Word, texto, PDF e formato sem prévia no visualizador; maximiza, imprime e baixa', async ({ page, baseURL }) => {
  const id = unico();
  mkdirSync(PASTA, { recursive: true });
  writeFileSync(resolve(PASTA, `norma-${id}.docx`), docx(`Texto do Word ${id}`));
  writeFileSync(resolve(PASTA, `lista-${id}.txt`), `Linha de texto ${id}`);
  writeFileSync(resolve(PASTA, `manual-${id}.pdf`), PDF);
  writeFileSync(resolve(PASTA, `tabela-${id}.xlsx`), 'nao e uma planilha de verdade');
  const admin = await apiComo(baseURL!, ADMIN);
  for (const [ext, fmt] of [['docx', 'Word'], ['txt', 'Texto'], ['pdf', 'PDF'], ['xlsx', 'Excel']]) {
    const r = await admin.post('/api/gestao/documentos', { data: { titulo: `Doc ${fmt} ${id}`, categoria: 'Teste', resumo: 'Resumo', formato: fmt, origem: 'pasta', link_oficial: `${fmt === 'Word' ? 'norma' : fmt === 'Texto' ? 'lista' : fmt === 'PDF' ? 'manual' : 'tabela'}-${id}.${ext}`, publicado: true } });
    expect(r.status(), await r.text()).toBe(201);
  }

  await entrar(page);
  await page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Documentos', exact: true }).click();
  const abrir = async (fmt: string) => page.locator('article.cartao-doc', { hasText: `Doc ${fmt} ${id}` }).getByRole('button', { name: /Visualizar/ }).click();
  const janela = page.locator('dialog.janela-visual[open]');

  // Word: o texto aparece dentro do quadro
  await abrir('Word');
  await expect(janela.frameLocator('iframe').getByText(`Texto do Word ${id}`)).toBeVisible();
  // maximizar e reduzir
  await expect(janela).not.toHaveClass(/janela-visual-grande/);
  await janela.getByRole('button', { name: 'Maximizar janela' }).click();
  await expect(janela).toHaveClass(/janela-visual-grande/);
  await janela.getByRole('button', { name: 'Reduzir janela' }).click();
  await expect(janela).not.toHaveClass(/janela-visual-grande/);
  // imprimir chama a impressão do quadro
  await janela.locator('iframe').evaluate((f) => { (f as HTMLIFrameElement).contentWindow!.print = () => { (window as unknown as { __imprimiu: boolean }).__imprimiu = true; }; });
  await janela.getByRole('button', { name: 'Imprimir documento' }).click();
  expect(await page.evaluate(() => (window as unknown as { __imprimiu?: boolean }).__imprimiu)).toBe(true);
  // baixar: o arquivo sai como anexo, com o nome original
  const [download] = await Promise.all([page.waitForEvent('download'), janela.getByRole('link', { name: 'Baixar documento' }).click()]);
  expect(download.suggestedFilename()).toBe(`norma-${id}.docx`);
  await janela.getByRole('button', { name: 'Fechar' }).click();
  await expect(janela).toHaveCount(0);

  // Texto
  await abrir('Texto');
  await expect(janela.frameLocator('iframe').getByText(`Linha de texto ${id}`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(janela).toHaveCount(0);

  // PDF: abre num quadro (o leitor de PDF é do navegador)
  await abrir('PDF');
  await expect(janela.locator('iframe.visual-quadro')).toBeVisible();
  await janela.getByRole('button', { name: 'Fechar' }).click();

  // Formato sem prévia: avisa e deixa baixar
  await abrir('Excel');
  await expect(janela).toContainText('não tem pré-visualização');
  await expect(janela.getByRole('button', { name: 'Imprimir documento' })).toBeDisabled();
  await expect(janela.getByRole('link', { name: 'Baixar documento' })).toBeVisible();
  await admin.dispose();
});
