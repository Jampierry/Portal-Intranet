// Responder uma pesquisa pelo pop-up (uma pergunta por vez) e conferir que não volta a aparecer.
import { test, expect } from '@playwright/test';
import { ADMIN, apiComo, criarPerfil, criarPessoa, entrar, unico } from './ajuda.ts';

test.use({ viewport: { width: 1366, height: 768 } });

test('colaborador responde a pesquisa em passos, recebe o agradecimento e não vê o pop-up de novo', async ({ page, baseURL }) => {
  const id = unico();
  const titulo = `Pesquisa de teste ${id}`;
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor pesquisa ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `col.${id}`, nome: `Colaborador ${id}`, perfil });
  const criada = await admin.post('/api/gestao/pulso', {
    data: {
      pergunta: titulo, descricao: 'Leva um minuto.', status: 'aberto', anonima: true,
      perguntas: [
        { texto: 'Você gostou do evento?', tipo: 'unica', obrigatoria: true, opcoes: [{ texto: 'Sim' }, { texto: 'Não' }] },
        { texto: 'Que nota você dá ao evento?', tipo: 'nota', obrigatoria: true },
      ],
    },
  });
  expect(criada.status(), await criada.text()).toBe(201);
  const pulsoId = (await criada.json()).id as number;

  await entrar(page, pessoa, false);
  const pop = page.getByRole('dialog', { name: titulo });
  await expect(pop).toBeVisible();

  // passo 1: só avança com a resposta
  const proxima = pop.getByRole('button', { name: 'Próxima' });
  await expect(proxima).toBeDisabled();
  await pop.getByText('Sim', { exact: true }).click();
  await expect(proxima).toBeEnabled();
  await proxima.click();

  // passo 2: nota e envio
  const enviar = pop.getByRole('button', { name: 'Enviar resposta' });
  await expect(enviar).toBeDisabled();
  await pop.getByRole('radio', { name: /Bom/ }).first().click();
  await expect(enviar).toBeEnabled();
  await enviar.click();
  // depois de enviar, o título some e o pop-up perde o nome acessível: procura pela caixa
  await expect(page.locator('.pulso-modal').getByRole('status')).toContainText('Obrigado');
  await expect(page.locator('.pq-fogos')).toBeVisible();

  // a resposta foi gravada e a pesquisa sai da fila dessa pessoa
  const ctx = await apiComo(baseURL!, pessoa);
  const estado = await (await ctx.get('/api/pulso')).json() as { aberto: boolean; id?: number };
  expect(estado.aberto && estado.id === pulsoId, 'não pode voltar a pedir a mesma pesquisa').toBeFalsy();
  expect((await ctx.post(`/api/pulso/${pulsoId}/responder`, { data: { respostas: [] } })).ok(), 'segunda resposta recusada').toBeFalsy();
  await ctx.dispose();

  await page.reload();
  await expect(page.locator('.rodape-portal')).toBeVisible();
  await expect(page.getByRole('dialog', { name: titulo })).toHaveCount(0);

  await admin.dispose();
});

test('"Responder depois" fecha o pop-up sem gravar resposta', async ({ page, baseURL }) => {
  const id = unico();
  const titulo = `Pesquisa adiada ${id}`;
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor adia ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `adia.${id}`, nome: `Adia ${id}`, perfil });
  const criada = await admin.post('/api/gestao/pulso', { data: { pergunta: titulo, status: 'aberto', perguntas: [{ texto: 'Como foi o mês?', tipo: 'nota', obrigatoria: true }] } });
  expect(criada.status(), await criada.text()).toBe(201);

  await entrar(page, pessoa, false);
  const pop = page.getByRole('dialog', { name: titulo });
  await expect(pop).toBeVisible();
  await pop.getByRole('button', { name: 'Responder depois', exact: true }).click();
  await expect(pop).toHaveCount(0);

  const ctx = await apiComo(baseURL!, pessoa);
  const estado = await (await ctx.get('/api/pulso')).json() as { aberto: boolean; titulo?: string };
  expect(estado.aberto && estado.titulo === titulo, 'continua pendente').toBeTruthy();
  await ctx.dispose();
  await admin.dispose();
});

test('pesquisa para um departamento: o pop-up aparece só para quem é dele', async ({ page, browser, baseURL }) => {
  const id = unico();
  const titulo = `Clima do Financeiro ${id}`;
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Leitor depto ${id}`, ['ver.comunicados']);
  const dep = async (nome: string) => (await (await admin.post('/api/departamentos', { data: { nome: `${nome} ${id}` } })).json() as { id: number }).id;
  const fin = await dep('Financeiro'), mkt = await dep('Marketing');
  const gente = async (login: string, depto: number) => {
    const p = await criarPessoa(admin, baseURL!, { login: `${login}.${id}`, nome: `${login} ${id}`, perfil });
    const uid = ((await (await admin.get('/api/usuarios')).json()) as { id: number; login: string }[]).find((u) => u.login === p.login)!.id;
    expect((await admin.put(`/api/usuarios/${uid}`, { data: { departamento_id: depto } })).ok()).toBeTruthy();
    return p;
  };
  const doFin = await gente('fin', fin), doMkt = await gente('mkt', mkt);
  const criada = await admin.post('/api/gestao/pulso', { data: { pergunta: titulo, status: 'aberto', anonima: true, departamentos: [fin], perguntas: [{ texto: 'Como você está?', tipo: 'nota', obrigatoria: true }] } });
  expect(criada.status(), await criada.text()).toBe(201);

  await entrar(page, doFin, false);
  await expect(page.getByRole('dialog', { name: titulo })).toBeVisible();

  const contexto2 = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const outra = await contexto2.newPage();
  await entrar(outra, doMkt, false);
  await expect(outra.getByRole('dialog', { name: titulo })).toHaveCount(0);
  await contexto2.close();
  await admin.dispose();
});
