// Configurações › Dados de exemplo: só o administrador liga ou desliga o pacote de dados fictícios (empresa "Aurora Esportes").
import type { FastifyInstance } from 'fastify';
import { config } from '../../../servidor/src/config.ts';
import type { Banco } from '../../../servidor/src/db.ts';
import { corpoObjeto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { auditar, exigir } from '../../acessos/api/guard.ts';
import { ativarExemplo, desativarExemplo, estadoExemplo, SENHA_USUARIOS_EXEMPLO } from './pacote.ts';

export async function rotasDemonstracao(app: FastifyInstance, { db, producao }: { db: Banco; producao: boolean }) {
  const estado = () => ({ ...estadoExemplo(db), producao, permitido: config.permitirExemplo, senha_exemplo: producao ? null : SENHA_USUARIOS_EXEMPLO });

  app.get('/api/gestao/demonstracao', { preHandler: exigir('admin') }, async () => estado());

  app.post('/api/gestao/demonstracao', { preHandler: exigir('admin') }, async (req) => {
    const c = corpoObjeto(req.body);
    if (typeof c.ativo !== 'boolean') throw new ErroValidacao('Informe se os dados de exemplo ficam ligados ou desligados.');
    if (c.ativo && !config.permitirExemplo) throw new ErroValidacao('Dados de exemplo não podem ser ligados em produção (defina PERMITIR_DADOS_EXEMPLO=1 no servidor, se for mesmo necessário).');
    if (c.ativo) ativarExemplo(db, { producao });
    else desativarExemplo(db);
    auditar(db, req.usuario!.id, c.ativo ? 'exemplo_ligado' : 'exemplo_desligado', {});
    return estado();
  });
}
