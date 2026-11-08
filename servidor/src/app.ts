import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type { Banco } from './db.ts';
import { rotasAcessos } from '../../modulos/acessos/api/index.ts';
import { rotasAplicacoes } from '../../modulos/aplicacoes/api/index.ts';
import { rotasComunicados } from '../../modulos/comunicados/api/index.ts';
import { rotasIntegracoes } from '../../modulos/integracoes/api/index.ts';
import { rotasCalendario } from '../../modulos/calendario/api/index.ts';
import { rotasBanners } from '../../modulos/banners/api/index.ts';
import { rotasDocumentos } from '../../modulos/documentos/api/index.ts';
import { rotasInstitucional } from '../../modulos/institucional/api/index.ts';
import { rotasPessoas } from '../../modulos/pessoas/api/index.ts';
import { rotasPessoasMes } from '../../modulos/pessoasmes/api/index.ts';
import { rotasImagens } from '../../modulos/imagens/api/index.ts';
import { rotasInicio } from '../../modulos/inicio/api/index.ts';
import { rotasMarca } from '../../modulos/marca/api/index.ts';

/** Cada módulo exporta uma função de rotas e entra aqui. */
export const MODULOS = [
  { nome: 'acessos', rotas: rotasAcessos }, // primeiro: registra a proteção global de /api
  { nome: 'aplicacoes', rotas: rotasAplicacoes },
  { nome: 'banners', rotas: rotasBanners },
  { nome: 'calendario', rotas: rotasCalendario },
  { nome: 'comunicados', rotas: rotasComunicados },
  { nome: 'documentos', rotas: rotasDocumentos },
  { nome: 'imagens', rotas: rotasImagens },
  { nome: 'inicio', rotas: rotasInicio },
  { nome: 'integracoes', rotas: rotasIntegracoes },
  { nome: 'institucional', rotas: rotasInstitucional },
  { nome: 'marca', rotas: rotasMarca },
  { nome: 'pessoas', rotas: rotasPessoas },
  { nome: 'pessoasmes', rotas: rotasPessoasMes },
];

export async function criarApp(db: Banco, producao = false) {
  const app = Fastify({ logger: producao });
  await app.register(cookie);
  // Quem abrir a porta da API no navegador é levado ao site (em desenvolvimento, o Vite na 5174).
  if (!producao) app.get('/', async (_req, resp) => resp.redirect('http://localhost:5174/'));
  app.get('/api/saude', async () => ({ ok: true, versao: '0.1.0', modulos: MODULOS.map((m) => m.nome) }));
  for (const m of MODULOS) await m.rotas(app, { db, producao });
  return app;
}
