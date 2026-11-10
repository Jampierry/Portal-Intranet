// Missão, visão, propósito e valores exibidos no Início: leitura para todos os logados; edição por editor e admin.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, ErroValidacao, texto } from '../../../servidor/src/validar.ts';

interface Institucional { missao: string; visao: string; proposito: string; valores: string[] }
const MAX_VALORES = 8;

function ler(db: Banco): Institucional {
  const linhas = db.prepare('SELECT chave, texto FROM institucional').all() as { chave: string; texto: string }[];
  const t = (k: string) => linhas.find((l) => l.chave === k)?.texto ?? '';
  return { missao: t('missao'), visao: t('visao'), proposito: t('proposito'), valores: t('valores').split('\n').map((v) => v.trim()).filter(Boolean) };
}

export async function rotasInstitucional(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/institucional', async () => ler(db));

  app.put('/api/gestao/institucional', { preHandler: exigirPerm('pub.institucional.editar') }, async (req) => {
    const c = corpoObjeto(req.body);
    const missao = texto(c, 'missao', 'Missão', { max: 400, opcional: true }) ?? '';
    const visao = texto(c, 'visao', 'Visão', { max: 400, opcional: true }) ?? '';
    const proposito = texto(c, 'proposito', 'Propósito', { max: 400, opcional: true }) ?? '';
    const bruto = texto(c, 'valores', 'Valores', { max: 800, opcional: true }) ?? '';
    const valores = bruto.split('\n').map((v) => v.trim()).filter(Boolean);
    if (valores.length > MAX_VALORES) throw new ErroValidacao(`Valores: no máximo ${MAX_VALORES} (um por linha).`);
    if (valores.some((v) => v.length > 60)) throw new ErroValidacao('Valores: cada valor pode ter até 60 caracteres.');
    const agora = new Date().toISOString();
    const grava = db.prepare('INSERT INTO institucional (chave, texto, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET texto = excluded.texto, atualizado_em = excluded.atualizado_em');
    for (const [k, v] of [['missao', missao], ['visao', visao], ['proposito', proposito], ['valores', valores.join('\n')]] as const) grava.run(k, v, agora);
    auditar(db, req.usuario!.id, 'institucional_alterado');
    return ler(db);
  });
}
