import { config } from './config.ts';
import { abrirBanco, migrar } from './db.ts';
import { criarApp } from './app.ts';

const db = abrirBanco(config.caminhoBanco);
const novas = migrar(db, config.pastaMigracoes);
if (novas.length) console.log('Migrações aplicadas:', novas.join(', '));

const app = await criarApp(db, config.producao);
await app.listen({ port: config.porta, host: '127.0.0.1' });
console.log(`Portal (API) em http://localhost:${config.porta}  |  banco: ${config.caminhoBanco}`);
