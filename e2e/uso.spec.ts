// Painel "Uso do portal" (Configurações): o administrador vê adoção por departamento e por pessoa; quem não tem a permissão é negado.
import { test, expect } from '@playwright/test';
import { ADMIN, apiComo, criarPerfil, criarPessoa, entrar, unico } from './ajuda.ts';

test.use({ viewport: { width: 1366, height: 768 } });

test('administrador vê o uso por departamento e por pessoa e pode filtrar; sem a permissão a API nega', async ({ page, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Vendas ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `vend.${id}`, nome: `Vendedora ${id}`, perfil });
  const depto = await (await admin.post('/api/departamentos', { data: { nome: `Vendas ${id}` } })).json() as { id: number };
  const lista = await (await admin.get('/api/usuarios')).json() as { id: number; login: string }[];
  const uid = lista.find((u) => u.login === pessoa.login)!.id;
  expect((await admin.put(`/api/usuarios/${uid}`, { data: { departamento_id: depto.id } })).ok()).toBeTruthy();

  // a pessoa usa o portal (entra e abre uma tela)
  const ctx = await apiComo(baseURL!, pessoa);
  expect((await ctx.post('/api/uso/tela', { data: { tela: 'comunicados' } })).ok()).toBeTruthy();

  await entrar(page);
  await page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('tab', { name: 'Uso do portal' }).click();
  await expect(page.getByText('Pessoas ativas', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Telas mais usadas' })).toBeVisible();
  const linhaDepto = page.getByRole('row', { name: new RegExp(`^Vendas ${id}`) });
  await expect(linhaDepto).toContainText('100%');
  const linhaPessoa = page.getByRole('row', { name: new RegExp(`Vendedora ${id}`) });
  await expect(linhaPessoa).toContainText(`Vendas ${id}`);
  await expect(linhaPessoa).toContainText('Comunicados');

  // filtrar por departamento
  await page.getByLabel('Departamento', { exact: true }).selectOption({ label: `Vendas ${id}` });
  await expect(page.getByRole('row', { name: new RegExp(`Vendedora ${id}`) })).toBeVisible();
  await expect(page.getByRole('row', { name: /Admin/ })).toHaveCount(0);

  expect((await ctx.get('/api/gestao/uso/resumo')).status()).toBe(403);
  await ctx.dispose(); await admin.dispose();
});

test('a tela aberta é registrada sozinha quando a pessoa navega', async ({ page, baseURL }) => {
  const admin = await apiComo(baseURL!, ADMIN);
  await entrar(page);
  await page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Documentos', exact: true }).click();
  await expect(async () => {
    const r = await (await admin.get('/api/gestao/uso/resumo?dias=7')).json() as { telas: { tela: string }[] };
    expect(r.telas.map((t) => t.tela)).toContain('documentos');
  }).toPass();
  await admin.dispose();
});

test('painel mostra comunicados lidos × publicados e exporta CSV e PDF', async ({ page, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor uso ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `lei.${id}`, nome: `Leitora ${id}`, perfil });
  const titulo = `Comunicado de uso ${id}`;
  const criado = await (await admin.post('/api/gestao/comunicados', { data: { titulo, resumo: 'Resumo', categoria: 'RH', status: 'publicado' } })).json() as { slug: string };
  const ctx = await apiComo(baseURL!, pessoa);
  expect((await ctx.get(`/api/comunicados/${criado.slug}`)).ok()).toBeTruthy(); // abrir conta como leitura

  await entrar(page);
  await page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('tab', { name: 'Uso do portal' }).click();
  await expect(page.getByText('Comunicados publicados', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comunicados: lidos × publicados' })).toBeVisible();
  await expect(page.locator('.uso-comunicados li', { hasText: titulo })).toBeVisible();

  // CSV baixa de verdade, com o comunicado dentro
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Exportar CSV' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^uso-do-portal-\d+-dias\.csv$/);
  const corpo = (await (await import('node:fs/promises')).readFile(await csv.path()!, 'utf-8'));
  expect(corpo).toContain(titulo);

  // PDF: abre o relatório numa janela própria (o navegador imprime; aqui só conferimos o conteúdo)
  await page.addInitScript(() => { window.print = () => undefined; });
  const [relatorio] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'Exportar PDF' }).click()]);
  await relatorio.waitForLoadState();
  await expect(relatorio.getByRole('heading', { name: 'Uso do portal' })).toBeVisible();
  await expect(relatorio.getByText(titulo)).toBeVisible();
  await ctx.dispose(); await admin.dispose();
});
