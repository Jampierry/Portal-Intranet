// Permissões por perfil, confirmação de leitura e pedido de autorização para editar conteúdo de outra pessoa.
import { test, expect } from '@playwright/test';
import { ADMIN, apiComo, criarPerfil, criarPessoa, entrar, unico } from './ajuda.ts';

test.use({ viewport: { width: 1366, height: 768 } });

const MENU = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Seções do portal' });

test('perfil só de leitura não vê Publicar nem Configurações e a API nega', async ({ page, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Somente leitura ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `leitor.${id}`, nome: `Leitor ${id}`, perfil });

  await entrar(page, pessoa);
  await expect(MENU(page).getByRole('button', { name: 'Comunicados', exact: true })).toBeVisible();
  await expect(MENU(page).getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0);
  await expect(MENU(page).getByRole('button', { name: 'Configurações', exact: true })).toHaveCount(0);

  const ctx = await apiComo(baseURL!, pessoa);
  expect((await ctx.get('/api/gestao/comunicados')).status()).toBe(403);
  expect((await ctx.get('/api/usuarios')).status()).toBe(403);
  expect((await ctx.post('/api/gestao/comunicados', { data: { titulo: 'Não pode', resumo: 'x', categoria: 'RH', status: 'publicado' } })).status()).toBe(403);
  await ctx.dispose();
  await admin.dispose();
});

test('confirmação de leitura: o botão grava, o aviso muda e a API passa a marcar como lido', async ({ page, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor ciente ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `ciente.${id}`, nome: `Ciente ${id}`, perfil });
  const criado = await admin.post('/api/gestao/comunicados', { data: { titulo: `Leitura obrigatória ${id}`, resumo: 'Leia com atenção.', corpo: 'Texto do comunicado.', categoria: 'RH', status: 'publicado', exige_leitura: true } });
  expect(criado.status(), await criado.text()).toBe(201);
  const slug = (await criado.json()).slug as string;

  await entrar(page, pessoa);
  await page.evaluate((s) => { location.hash = `#comunicados/${s}`; }, slug);
  const caixa = page.getByRole('group', { name: 'Confirmação de leitura' });
  await expect(caixa).toBeVisible();
  await caixa.getByRole('button', { name: 'Li e estou ciente' }).click();
  await expect(page.getByText('Leitura confirmada')).toBeVisible();
  await expect(caixa).toHaveCount(0);

  const ctx = await apiComo(baseURL!, pessoa);
  const det = await (await ctx.get(`/api/comunicados/${slug}`)).json() as { lido: boolean };
  expect(det.lido).toBeTruthy();
  await ctx.dispose();
  await admin.dispose();
});

test('editar conteúdo de outra pessoa exige autorização do dono; apagar é só do administrador', async ({ baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perm = ['ver.comunicados', 'pub.comunicados.ver', 'pub.comunicados.criar', 'pub.comunicados.editar', 'pub.comunicados.excluir'];
  const perfil = await criarPerfil(admin, `Redator ${id}`, perm);
  const dona = await criarPessoa(admin, baseURL!, { login: `dona.${id}`, nome: `Dona ${id}`, perfil });
  const outra = await criarPessoa(admin, baseURL!, { login: `outra.${id}`, nome: `Outra ${id}`, perfil });
  const apiDona = await apiComo(baseURL!, dona);
  const apiOutra = await apiComo(baseURL!, outra);

  const base = { titulo: `Do dono ${id}`, resumo: 'Original.', categoria: 'RH', status: 'publicado' };
  const criado = await apiDona.post('/api/gestao/comunicados', { data: base });
  expect(criado.status()).toBe(201);
  const cid = (await criado.json()).id as number;

  // sem autorização: editar e apagar são negados
  const negado = await apiOutra.put(`/api/gestao/comunicados/${cid}`, { data: { ...base, resumo: 'Mudou.' } });
  expect(negado.status()).toBe(403);
  expect((await negado.json()).codigo).toBe('precisa_autorizacao');
  expect((await apiOutra.delete(`/api/gestao/comunicados/${cid}`)).status()).toBe(403);

  // pede, o dono autoriza, a edição passa
  const pedido = await apiOutra.post('/api/pedidos-edicao', { data: { recurso: 'comunicado', registro: String(cid) } });
  expect(pedido.status()).toBe(201);
  const caixa = await (await apiDona.get('/api/pedidos-edicao/caixa')).json() as { pendentes: { id: number; titulo: string }[] };
  const pendente = caixa.pendentes.find((p) => p.titulo === base.titulo)!;
  expect(pendente, 'o pedido chega ao dono').toBeTruthy();
  expect((await apiDona.post(`/api/pedidos-edicao/${pendente.id}/decidir`, { data: { aprovar: true } })).ok()).toBeTruthy();
  expect((await apiOutra.put(`/api/gestao/comunicados/${cid}`, { data: { ...base, resumo: 'Mudou.' } })).ok()).toBeTruthy();

  // mesmo autorizada a editar, ela não apaga o que é de outra pessoa; o administrador apaga
  expect((await apiOutra.delete(`/api/gestao/comunicados/${cid}`)).status()).toBe(403);
  expect((await admin.delete(`/api/gestao/comunicados/${cid}`)).ok()).toBeTruthy();

  await apiDona.dispose(); await apiOutra.dispose(); await admin.dispose();
});
