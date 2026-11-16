// Biometria no navegador de verdade: um autenticador virtual (CDP) faz o papel da digital/rosto do aparelho.
// Usa http://localhost (WebAuthn não funciona com IP) e "manter conectado".
import { test, expect } from '@playwright/test';
import { ADMIN, apiComo, criarPerfil, criarPessoa, entrar, unico } from './ajuda.ts';

test.use({ baseURL: `http://localhost:${process.env.PORTA_SITE_E2E ?? '5274'}`, viewport: { width: 1366, height: 768 } });

test('cadastra a biometria no perfil, sai e entra de novo só com a biometria, mantendo conectado por 30 dias', async ({ page, context, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Bio ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `bio.${id}`, nome: `Bio ${id}`, perfil });

  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  await entrar(page, pessoa);
  await page.evaluate(() => { location.hash = '#perfil'; });
  await page.getByRole('button', { name: 'Cadastrar a biometria deste aparelho' }).click();
  await expect(page.getByText('Biometria cadastrada.')).toBeVisible();
  await expect(page.locator('.biometria-lista li')).toHaveCount(1);

  // sai (a sessão acaba) e volta pela biometria, marcando "manter conectado"
  await page.evaluate(() => fetch('/api/sair', { method: 'POST' }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await page.getByLabel(/Manter conectado/).check();
  await page.getByRole('button', { name: 'Entrar com biometria' }).click();
  await expect(page.locator('.rodape-portal')).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === 'portal_sessao')!;
  const dias = (cookie.expires - Date.now() / 1000) / 86400;
  expect(dias, 'cookie de 30 dias').toBeGreaterThan(29);

  // remover a biometria
  await page.evaluate(() => { location.hash = '#perfil'; });
  await page.locator('.biometria-lista li').getByRole('button', { name: 'Remover' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Remover' }).click();
  await expect(page.locator('.biometria-lista li')).toHaveCount(0);

  await admin.dispose();
});

test('sem marcar "manter conectado" a sessão é de 12 horas', async ({ page, context, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Curta ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `curta.${id}`, nome: `Curta ${id}`, perfil });
  await entrar(page, pessoa);
  const cookie = (await context.cookies()).find((c) => c.name === 'portal_sessao')!;
  const horas = (cookie.expires - Date.now() / 1000) / 3600;
  expect(horas).toBeGreaterThan(11);
  expect(horas).toBeLessThan(13);
  await admin.dispose();
});

test('sem biometria cadastrada: o ícone avisa com calma e, depois do login, o portal sugere cadastrar', async ({ page, context, baseURL }) => {
  const id = unico();
  const admin = await apiComo(baseURL!, ADMIN);
  const perfil = await criarPerfil(admin, `Oferta ${id}`, ['ver.comunicados']);
  const pessoa = await criarPessoa(admin, baseURL!, { login: `oferta.${id}`, nome: `Oferta ${id}`, perfil });
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com biometria' }).click();
  await expect(page.locator('.entrar-dica')).toContainText('ainda não tem sua biometria');
  await expect(page.getByRole('alert')).toHaveCount(0);

  // entra com a senha: o portal oferece o cadastro
  await page.getByLabel('Login').fill(pessoa.login);
  await page.getByLabel('Senha', { exact: true }).fill(pessoa.senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const oferta = page.locator('dialog[open]');
  await expect(oferta).toContainText('Entrar com digital ou rosto?');
  await oferta.getByRole('button', { name: 'Cadastrar agora' }).click();
  await expect(page.locator('dialog[open]')).toContainText('Biometria cadastrada');
  await page.locator('dialog[open]').getByRole('button').last().click();
  const lista = await (await (await apiComo(baseURL!, pessoa)).get('/api/biometria')).json() as unknown[];
  expect(lista).toHaveLength(1);
  await admin.dispose();
});
