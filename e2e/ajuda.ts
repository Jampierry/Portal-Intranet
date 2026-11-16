// Apoio dos testes de tela: login, tema guardado e coleta de erros do navegador.
import { expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

export const ADMIN = { login: 'admin', senha: 'admin123' };

/** Guarda o tema do usuário antes de a página abrir (mesma chave que web/src/tema.tsx usa). */
export async function definirTema(page: Page, modo: 'claro' | 'escuro', estilo = 'dipaula') {
  await page.addInitScript(([m, e]) => localStorage.setItem('portal.tema', JSON.stringify({ modo: m, estilo: e, menuRecolhido: false, escala: 100 })), [modo, estilo]);
}

/** Erros de JavaScript e de console que a tela soltou (o teste confere que a lista fica vazia). */
export function coletarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Recurso externo fora do ar (favicon etc.) não é defeito do portal.
    if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) erros.push(`console: ${m.text()}`);
  });
  return erros;
}

export async function entrar(page: Page, { login, senha } = ADMIN, dispensarPesquisa = true) {
  await page.goto('/');
  await page.getByLabel('Login').fill(login);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('.rodape-portal')).toBeVisible();
  if (!dispensarPesquisa) return;
  // Os dados de exemplo trazem uma pesquisa aberta: o pop-up cobre a tela até ser dispensado (Esc).
  const popup = page.locator('.pulso-overlay');
  if (await popup.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false)) {
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
  }
}

// ----- Preparo dos testes que gravam: tudo pela API, sem mexer nos dados de exemplo -----
export const SENHA_PROVISORIA = 'Provisoria-e2e-1!';
export const SENHA_FINAL = 'Definitiva-e2e-2!';

/** Sufixo único por execução: nomes, logins e títulos não colidem entre testes. */
export const unico = () => Math.random().toString(36).slice(2, 8);

/** Sessão de API de uma pessoa (mesmo caminho do navegador: cookie + Origin do site). */
export async function apiComo(baseURL: string, { login, senha }: { login: string; senha: string }): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const r = await ctx.post('/api/login', { data: { login, senha } });
  expect(r.ok(), `login de ${login}: ${r.status()} ${await r.text()}`).toBeTruthy();
  return ctx;
}

/** Cria um perfil com as permissões dadas e devolve o código dele. */
export async function criarPerfil(admin: APIRequestContext, nome: string, permissoes: string[]): Promise<string> {
  const r = await admin.post('/api/perfis', { data: { nome, permissoes } });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).codigo as string;
}

/** Cria a pessoa já com a senha definitiva (a provisória é trocada, como o portal exige). Devolve o login e a senha. */
export async function criarPessoa(admin: APIRequestContext, baseURL: string, { login, nome, perfil }: { login: string; nome: string; perfil: string }) {
  const r = await admin.post('/api/usuarios', { data: { login, nome, perfil, senha: SENHA_PROVISORIA } });
  expect(r.status(), await r.text()).toBe(201);
  const ctx = await apiComo(baseURL, { login, senha: SENHA_PROVISORIA });
  const t = await ctx.post('/api/eu/senha', { data: { atual: SENHA_PROVISORIA, nova: SENHA_FINAL } });
  expect(t.ok(), await t.text()).toBeTruthy();
  await ctx.dispose();
  return { login, senha: SENHA_FINAL };
}

/** Sem barra de rolagem horizontal na página (conteúdo vazando da tela). */
export async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, 'a página não pode ter rolagem horizontal').toBeLessThanOrEqual(1);
}
