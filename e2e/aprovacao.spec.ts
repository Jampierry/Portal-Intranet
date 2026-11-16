// Publicar com aprovação do RH: quem precisa de aprovação envia, o comunicado fica em rascunho, o administrador aprova na fila e ele sobe.
import { test, expect } from '@playwright/test';
import { ADMIN, apiComo, criarPerfil, criarPessoa, entrar, unico } from './ajuda.ts';

test.use({ viewport: { width: 1366, height: 768 } });

test('comunicado de quem precisa de aprovação só sobe depois que o administrador aprova', async ({ page, baseURL }) => {
  const id = unico();
  const titulo = `Aviso de teste ${id}`;
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Marketing e2e ${id}`, ['ver.comunicados', 'pub.comunicados.ver', 'pub.comunicados.criar', 'pub.comunicados.aprovacao']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `mkt.${id}`, nome: `Marketing ${id}`, perfil });

  // quem precisa de aprovação pede para publicar: vai a rascunho e entra na fila
  const mkt = await apiComo(baseURL!, pessoa);
  const criado = await mkt.post('/api/gestao/comunicados', { data: { titulo, resumo: 'Resumo do aviso de teste.', categoria: 'RH', status: 'publicado' } });
  expect(criado.status()).toBe(201);
  expect((await criado.json()).status).toBe('rascunho');
  const antes = await (await admin.get('/api/comunicados')).json() as { titulo: string }[];
  expect(antes.some((c) => c.titulo === titulo), 'ainda não pode estar no portal').toBeFalsy();

  // o administrador aprova pela tela
  await entrar(page);
  await page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Publicar', exact: true }).click();
  await page.getByRole('tab', { name: 'Aprovações' }).click();
  const cartao = page.locator('.aprov-cartao', { hasText: titulo });
  await expect(cartao).toBeVisible();
  await cartao.getByRole('button', { name: 'Aprovar' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Aprovar' }).click();
  await expect(cartao).toHaveCount(0);

  // agora o comunicado está no portal
  const depois = await (await admin.get('/api/comunicados')).json() as { titulo: string }[];
  expect(depois.some((c) => c.titulo === titulo), 'depois da aprovação aparece no portal').toBeTruthy();
  await page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Comunicados', exact: true }).click();
  await expect(page.getByText(titulo).first()).toBeVisible();

  await mkt.dispose();
  await admin.dispose();
});

test('rejeitar exige motivo e o comunicado continua fora do portal', async ({ baseURL }) => {
  const id = unico();
  const titulo = `Aviso rejeitado ${id}`;
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Marketing rej ${id}`, ['ver.comunicados', 'pub.comunicados.ver', 'pub.comunicados.criar', 'pub.comunicados.aprovacao']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `rej.${id}`, nome: `Rejeitado ${id}`, perfil });
  const mkt = await apiComo(baseURL!, pessoa);
  await mkt.post('/api/gestao/comunicados', { data: { titulo, resumo: 'x', categoria: 'RH', status: 'publicado' } });
  const fila = await (await admin.get('/api/aprovacoes?situacao=pendentes')).json() as { id: number; titulo: string }[];
  const pedido = fila.find((p) => p.titulo === titulo)!;
  expect(pedido).toBeTruthy();

  expect((await admin.post(`/api/aprovacoes/${pedido.id}/decidir`, { data: { aprovar: false } })).status(), 'sem motivo não rejeita').toBe(400);
  expect((await admin.post(`/api/aprovacoes/${pedido.id}/decidir`, { data: { aprovar: false, motivo: 'Texto fora do padrão.' } })).ok()).toBeTruthy();
  const lista = await (await admin.get('/api/comunicados')).json() as { titulo: string }[];
  expect(lista.some((c) => c.titulo === titulo)).toBeFalsy();
  // quem pediu não aprova o próprio pedido (nem com a permissão da fila)
  expect((await mkt.post(`/api/aprovacoes/${pedido.id}/decidir`, { data: { aprovar: true } })).status()).toBe(403);

  await mkt.dispose();
  await admin.dispose();
});
