// Sobe uma API isolada para os testes de tela: banco novo em dados-privados/e2e (apagado a cada execução), com os dados de exemplo.
// Nunca mexe no banco de desenvolvimento (dados-privados/portal.db).
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const pasta = resolve(import.meta.dirname, '..', 'dados-privados', 'e2e');
rmSync(pasta, { recursive: true, force: true });
process.env.BANCO = resolve(pasta, 'portal.db');
process.env.PORTA = process.env.PORTA_API_E2E ?? '3200';
// 127.0.0.1 para os testes comuns e localhost para a biometria (WebAuthn nao aceita IP como endereco).
const site = process.env.PORTA_SITE_E2E ?? '5274';
process.env.ORIGENS_PERMITIDAS = `http://127.0.0.1:${site},http://localhost:${site}`;
delete process.env.PASTA_MIDIA;
process.env.DOCUMENTOS_PASTA = resolve(pasta, 'documentos'); // arquivos de teste dos documentos (nunca a pasta de desenvolvimento)
await import('../servidor/src/cli/seed.ts');
await import('../servidor/src/main.ts');
