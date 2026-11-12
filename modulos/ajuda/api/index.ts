// Ajuda: entrega os manuais (docs/manuais/*.md) para leitura dentro do portal. Só lê arquivos de uma lista fixa; cada manual aparece para quem tem o perfil a que ele se destina.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { config } from '../../../servidor/src/config.ts';

const MANUAIS = [
  { id: 'colaborador', titulo: 'Manual do colaborador', resumo: 'Entrar, Início, comunicados, documentos, aplicativos, pesquisas, Meu perfil e dúvidas.', arquivo: 'manual-colaborador.md', exige: null },
  { id: 'publicacao', titulo: 'Manual de quem publica', resumo: 'Como publicar comunicados, documentos, banners, contatos e redes sociais.', arquivo: 'manual-publicacao.md', exige: 'pub.' },
  { id: 'rh', titulo: 'Manual do RH', resumo: 'Aprovações, pesquisas, resultados e reconhecimento.', arquivo: 'manual-rh.md', exige: 'pub.' },
  { id: 'administrador', titulo: 'Manual do administrador', resumo: 'Usuários, perfis, permissões, integrações, backup e implantação.', arquivo: 'manual-administrador.md', exige: 'cfg.' },
] as const;

export async function rotasAjuda(app: FastifyInstance, _ctx: { db: Banco; producao: boolean }) {
  const visiveis = (permissoes: string[], admin: boolean) => MANUAIS.filter((m) => m.exige === null || admin || permissoes.some((p) => p.startsWith(m.exige)));
  app.get('/api/ajuda/manuais', async (req) => visiveis(req.usuario!.permissoes, req.usuario!.perfil === 'admin').map(({ id, titulo, resumo }) => ({ id, titulo, resumo })));
  app.get<{ Params: { id: string } }>('/api/ajuda/manuais/:id', async (req, resp) => {
    const m = visiveis(req.usuario!.permissoes, req.usuario!.perfil === 'admin').find((x) => x.id === req.params.id);
    if (!m) return resp.code(404).send({ erro: 'Manual não encontrado.' });
    try { return { id: m.id, titulo: m.titulo, texto: readFileSync(join(config.raiz, 'docs', 'manuais', m.arquivo), 'utf8') }; }
    catch { return resp.code(404).send({ erro: 'O arquivo deste manual não está disponível neste servidor.' }); }
  });
}
