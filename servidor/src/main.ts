import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import { abrirBanco, migrar } from './db.ts';
import { criarApp } from './app.ts';

if (config.producao) {
  // Trava de segurança: sem a origem pública, as alterações vindas do navegador seriam recusadas ou mal protegidas.
  if (!config.origensPermitidas.length) {
    console.error('Produção: defina ORIGENS_PERMITIDAS com o endereço público do portal (ex.: https://portal.suaempresa.com.br).');
    process.exit(1);
  }
  if (!existsSync(join(config.pastaSite, 'index.html'))) {
    console.error(`Produção: site compilado não encontrado em ${config.pastaSite}. Rode "npm run build" antes.`);
    process.exit(1);
  }
}

const db = abrirBanco(config.caminhoBanco);
const novas = migrar(db, config.pastaMigracoes);
if (novas.length) console.log('Migrações aplicadas:', novas.join(', '));

const app = await criarApp(db, config.producao);
await app.listen({ port: config.porta, host: config.host });
console.log(`Portal em http://${config.host}:${config.porta}  |  ${config.producao ? 'PRODUÇÃO' : 'desenvolvimento (API)'}  |  banco: ${config.caminhoBanco}`);

// Desligamento limpo (serviço parado ou reiniciado): termina as requisições em andamento e fecha o banco.
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    void app.close().finally(() => { db.close(); process.exit(0); });
  });
}
