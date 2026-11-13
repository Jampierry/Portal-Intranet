// Testes de tela (Playwright). `npm run e2e` sobe uma API e um site isolados (portas 3200/5274, banco novo com dados de exemplo)
// e abre o portal num navegador de verdade. Localmente usa o Edge já instalado; no CI usa o Chromium baixado pelo Playwright.
import { defineConfig } from '@playwright/test';

const PORTA_API = process.env.PORTA_API_E2E ?? '3200';
const PORTA_SITE = process.env.PORTA_SITE_E2E ?? '5274';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'dados-privados/e2e-resultados',
  use: {
    baseURL: `http://127.0.0.1:${PORTA_SITE}`,
    locale: 'pt-BR',
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/subir-api.ts',
      url: `http://127.0.0.1:${PORTA_API}/api/saude`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORTA_API_E2E: PORTA_API, PORTA_SITE_E2E: PORTA_SITE },
    },
    {
      command: 'npm run dev -w web -- --host 127.0.0.1 --strictPort',
      url: `http://127.0.0.1:${PORTA_SITE}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORTA_SITE: PORTA_SITE, API_ALVO: `http://127.0.0.1:${PORTA_API}` },
    },
  ],
});
