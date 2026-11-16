// RH escolhe o público de um comunicado (por departamento): só quem é do departamento vê; as demais pessoas não.
import { test, expect } from '@playwright/test';
import { ADMIN, apiComo, criarPerfil, criarPessoa, entrar, unico } from './ajuda.ts';

test.use({ viewport: { width: 1366, height: 768 } });
const MENU = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Seções do portal' });

async function pessoaDoDepartamento(admin: Awaited<ReturnType<typeof apiComo>>, baseURL: string, perfil: string, nome: string, depto: number, id: string) {
  const p = await criarPessoa(admin, baseURL, { login: `${nome}.${id}`, nome: `${nome} ${id}`, perfil });
  const lista = await (await admin.get('/api/usuarios')).json() as { id: number; login: string }[];
  const uid = lista.find((u) => u.login === p.login)!.id;
  expect((await admin.put(`/api/usuarios/${uid}`, { data: { departamento_id: depto } })).ok()).toBeTruthy();
  return p;
}

test('RH publica pelo formulário um comunicado só para um departamento; os de fora não o veem', async ({ page, browser, baseURL }) => {
  const id = unico();
  const titulo = `Aviso do Marketing ${id}`;
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor publico ${id}`, ['ver.comunicados']);
  const mkt = await (await admin.post('/api/departamentos', { data: { nome: `Marketing ${id}` } })).json() as { id: number };
  const fin = await (await admin.post('/api/departamentos', { data: { nome: `Financeiro ${id}` } })).json() as { id: number };
  const deMkt = await pessoaDoDepartamento(admin, baseURL!, perfil, 'ana', mkt.id, id);
  const deFin = await pessoaDoDepartamento(admin, baseURL!, perfil, 'rui', fin.id, id);

  // o RH preenche o formulário e escolhe o departamento
  await entrar(page);
  await MENU(page).getByRole('button', { name: 'Publicar', exact: true }).click();
  await page.getByRole('button', { name: /Novo comunicado/ }).click();
  const janela = page.locator('dialog[open]');
  await janela.getByLabel('Título').fill(titulo);
  await janela.getByLabel(/Resumo/).fill('Aviso só para o Marketing.');
  const categoria = janela.getByLabel('Categoria');
  await categoria.selectOption({ index: 1 }); // uma das categorias já existentes
  await janela.getByLabel('Situação').selectOption('publicado');
  await janela.getByLabel('Só alguns departamentos').check();
  await janela.getByLabel(`Marketing ${id}`).check();
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await expect(janela).toHaveCount(0);
  await expect(page.getByRole('row', { name: new RegExp(titulo) })).toContainText(`Marketing ${id}`);

  // quem é do departamento vê; quem é de outro não vê (lista e endereço direto)
  const ctxMkt = await apiComo(baseURL!, deMkt);
  const ctxFin = await apiComo(baseURL!, deFin);
  const vistos = async (c: typeof ctxMkt) => ((await (await c.get('/api/comunicados')).json()) as { slug: string; titulo: string }[]);
  const doMkt = (await vistos(ctxMkt)).find((c) => c.titulo === titulo);
  expect(doMkt, 'o Marketing vê').toBeTruthy();
  expect((await vistos(ctxFin)).some((c) => c.titulo === titulo), 'o Financeiro não vê').toBeFalsy();
  expect((await ctxFin.get(`/api/comunicados/${doMkt!.slug}`)).status()).toBe(404);

  // pela tela da pessoa do Marketing
  const contexto2 = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const pagina2 = await contexto2.newPage();
  await entrar(pagina2, deMkt);
  await pagina2.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Comunicados', exact: true }).click();
  await expect(pagina2.getByText(titulo).first()).toBeVisible();

  await contexto2.close();
  await ctxMkt.dispose(); await ctxFin.dispose(); await admin.dispose();
});

test('RH vê no sino quem está sem departamento e o botão abre o cadastro da pessoa', async ({ page, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor aviso ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `semd.${id}`, nome: `Sem Depto ${id}`, perfil });
  await entrar(page);
  await page.locator('button.sino').click();
  const aviso = page.locator('.painel-avisos .aviso', { hasText: `Sem Depto ${id}` });
  await expect(aviso).toContainText('está sem departamento');
  await aviso.getByRole('button', { name: 'Atualizar cadastro' }).click();
  const janela = page.locator('dialog[open]');
  await expect(janela).toContainText(`Editar ${pessoa.login}`);
  await admin.dispose();
});

test('comunicado "para todos" continua aparecendo para quem não tem departamento', async ({ baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor todos ${id}`, ['ver.comunicados']);
  const semDepto = await criarPessoa(admin, baseURL!, { login: `sem.${id}`, nome: `Sem depto ${id}`, perfil });
  const todos = await admin.post('/api/gestao/comunicados', { data: { titulo: `Para todos ${id}`, resumo: 'Resumo', categoria: 'RH', status: 'publicado' } });
  expect(todos.status()).toBe(201);
  const ctx = await apiComo(baseURL!, semDepto);
  expect(((await (await ctx.get('/api/comunicados')).json()) as { titulo: string }[]).some((c) => c.titulo === `Para todos ${id}`)).toBeTruthy();
  await ctx.dispose(); await admin.dispose();
});
