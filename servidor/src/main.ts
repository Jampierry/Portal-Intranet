import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import { abrirBanco, migrar } from './db.ts';
import { criarApp } from './app.ts';
import { avisarAberturas } from '../../modulos/pulso/api/index.ts';
import { criarAdminInicial } from './admin-inicial.ts';

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

// Plataforma sem acesso ao terminal: se o banco está sem usuários e ADMIN_LOGIN/ADMIN_SENHA foram definidos, cria o primeiro administrador.
const inicial = criarAdminInicial(db);
if (inicial) console.log(`Administrador inicial criado: ${inicial} (troca de senha no primeiro acesso). Remova ADMIN_SENHA do ambiente.`);

const app = await criarApp(db, config.producao);
await app.listen({ port: config.porta, host: config.host });
if (config.modoDebug) console.warn('MODO DEBUG LIGADO: os erros 500 mostram detalhes. Não use em produção.');
console.log(`Portal em http://${config.host}:${config.porta}  |  ${config.producao ? 'PRODUÇÃO' : 'desenvolvimento (API)'}  |  banco: ${config.caminhoBanco}`);

// Pesquisas agendadas: quando chega a hora de abrir, avisa por push (uma vez cada).
setInterval(() => { void avisarAberturas(db); }, 60_000).unref();

// Erros fora de uma requisição ficam registrados em vez de sumir.
process.on('unhandledRejection', (e) => console.error('Promessa rejeitada sem tratamento:', e));
process.on('uncaughtException', (e) => { console.error('Exceção não tratada:', e); process.exit(1); });

// Desligamento limpo (serviço parado ou reiniciado): termina as requisições em andamento e fecha o banco.
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    void app.close().finally(() => { db.close(); process.exit(0); });
  });
}
