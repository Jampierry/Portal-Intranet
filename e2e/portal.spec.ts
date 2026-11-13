import { test, expect } from '@playwright/test';
import { ADMIN, coletarErros, definirTema, entrar, semRolagemHorizontal } from './ajuda.ts';

test.describe('entrada', () => {
  test('senha errada mostra o erro e não entra', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Login').fill(ADMIN.login);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('.rodape-portal')).toHaveCount(0);
  });

  test('administrador entra e vê o Início sem erros de tela', async ({ page }) => {
    const erros = coletarErros(page);
    await entrar(page);
    await expect(page.getByText('Bem-vindo(a)')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Seções do portal' })).toBeVisible();
    expect(erros).toEqual([]);
  });
});

test.describe('navegação (computador)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  for (const tela of ['Comunicados', 'Documentos', 'Calendário', 'Pesquisas', 'Publicar', 'Contatos', 'Ajuda', 'Configurações']) {
    test(`abre ${tela} sem erros`, async ({ page }) => {
      const erros = coletarErros(page);
      await entrar(page);
      const item = page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: tela, exact: true });
      await item.click();
      await expect(item).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#conteudo-principal')).toBeVisible();
      await semRolagemHorizontal(page);
      expect(erros).toEqual([]);
    });
  }

  test('a barra de aplicativos e o menu vão até o fim da janela', async ({ page }) => {
    await entrar(page);
    const altura = page.viewportSize()!.height;
    const barra = await page.locator('.lancador').boundingBox();
    expect(barra!.y + barra!.height).toBeGreaterThanOrEqual(altura - 1);
    const menu = await page.locator('aside.menu').boundingBox();
    expect(menu!.y + menu!.height).toBeGreaterThanOrEqual(altura - 1);
  });
});

test.describe('temas', () => {
  test.use({ viewport: { width: 1366, height: 768 } });
  const estilos = ['dipaula', 'bordo', 'meianoite', 'ardosia', 'grafite', 'oceano', 'github', 'notion'];
  for (const modo of ['claro', 'escuro'] as const) {
    for (const estilo of estilos) {
      test(`${estilo} no modo ${modo} aplica o tema e abre o Início`, async ({ page }) => {
        const erros = coletarErros(page);
        await definirTema(page, modo, estilo);
        await entrar(page);
        await expect(page.locator('html')).toHaveAttribute('data-estilo', estilo);
        await expect(page.locator('html')).toHaveAttribute('data-tema', modo);
        await semRolagemHorizontal(page);
        expect(erros).toEqual([]);
      });
    }
  }
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });

  test('Início cabe na largura e as abas de baixo aparecem', async ({ page }) => {
    const erros = coletarErros(page);
    await entrar(page);
    await expect(page.locator('.abas-mobile')).toBeVisible();
    await semRolagemHorizontal(page);
    expect(erros).toEqual([]);
  });

  test('a barra de aplicativos abre recolhida e vai até o fim da tela, por cima das abas', async ({ page }) => {
    await entrar(page);
    await page.getByRole('button', { name: 'Aplicativos', exact: true }).first().click();
    const barra = page.locator('.lancador');
    await expect(barra).toBeVisible();
    const caixa = await barra.boundingBox();
    expect(caixa!.y).toBeLessThanOrEqual(1);
    expect(caixa!.y + caixa!.height).toBeGreaterThanOrEqual(780 - 1);
    expect(caixa!.width).toBeLessThan(100); // recolhida: só os ícones
  });
});

test.describe('celular: calendário lateral', () => {
  test.use({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });

  test('o mini calendário do menu e o painel lateral ficam ocultos', async ({ page }) => {
    await entrar(page);
    await expect(page.locator('.cal-menu')).toBeHidden();
    await expect(page.locator('.cal-voo-casca')).toBeHidden();
  });
});

test.describe('celular: abas de baixo', () => {
  test.use({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });

  test('o ícone Calendário leva direto ao calendário', async ({ page }) => {
    await entrar(page);
    await page.locator('.abas-mobile').getByRole('button', { name: 'Calendário' }).click();
    await expect(page.locator('.abas-mobile').getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/#calendario/);
    await semRolagemHorizontal(page);
  });
});

test.describe('manuais com prints', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('o manual do colaborador mostra os prints com setas (imagens carregam)', async ({ page }) => {
    await entrar(page);
    await page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: 'Ajuda', exact: true }).click();
    await page.locator('button[aria-pressed]').filter({ hasText: 'Manuais do sistema' }).click();
    await page.locator('.manual-cartao').filter({ hasText: 'Manual do colaborador' }).click();
    const figura = page.locator('.manual-figura img').first();
    await expect(figura).toBeVisible();
    await expect.poll(() => figura.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  });
});
