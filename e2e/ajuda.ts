// Apoio dos testes de tela: login, tema guardado e coleta de erros do navegador.
import { expect, type Page } from '@playwright/test';

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

export async function entrar(page: Page, { login, senha } = ADMIN) {
  await page.goto('/');
  await page.getByLabel('Login').fill(login);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('.rodape-portal')).toBeVisible();
  // Os dados de exemplo trazem uma pesquisa aberta: o pop-up cobre a tela até ser dispensado (Esc).
  const popup = page.locator('.pulso-overlay');
  if (await popup.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false)) {
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
  }
}

/** Sem barra de rolagem horizontal na página (conteúdo vazando da tela). */
export async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, 'a página não pode ter rolagem horizontal').toBeLessThanOrEqual(1);
}
