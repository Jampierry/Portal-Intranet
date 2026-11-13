// Instala a logo oficial da Di Paula (SVG validado pelo Marketing) como logo da empresa: a versão escura (para o tema claro)
// e a versão branca (para o tema escuro), lidas de web/public/marca/. Não mexe no resto da configuração da empresa.
//   npm run marca:logo            (rode de novo em cada ambiente: desenvolvimento, homologação e produção)
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import { abrirBanco, migrar } from '../db.ts';
import { guardarImagem } from '../../../modulos/imagens/api/index.ts';

const pasta = join(config.raiz, 'web', 'public', 'marca');
const db = abrirBanco(config.caminhoBanco);
migrar(db, config.pastaMigracoes);

const guardar = (arquivo: string) => {
  const conteudo = readFileSync(join(pasta, arquivo));
  // Nome pelo conteúdo: rodar de novo não cria cópias.
  const salvo = guardarImagem(db, conteudo, { aceitarSvg: true, nome: `${createHash('sha256').update(conteudo).digest('hex').slice(0, 24)}.svg` });
  if (!salvo) throw new Error(`${arquivo} não é um SVG aceito.`);
  return `/api/publico/imagens/${salvo.nome}`;
};
const logo_nome = guardar('logo-dipaula-claro.svg');
const logo_nome_escuro = guardar('logo-dipaula-escuro.svg');

const linha = db.prepare("SELECT valor FROM portal_config WHERE chave = 'empresa'").get() as { valor: string } | undefined;
const atual = linha ? JSON.parse(linha.valor) as Record<string, unknown> : {};
const novo = { ...atual, logo_nome, logo_nome_escuro };
db.prepare('INSERT INTO portal_config (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em')
  .run('empresa', JSON.stringify(novo), new Date().toISOString());
console.log(`Logo oficial instalada:\n  tema claro:  ${logo_nome}\n  tema escuro: ${logo_nome_escuro}`);
db.close();
