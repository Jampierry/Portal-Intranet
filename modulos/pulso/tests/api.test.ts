// Pesquisas (pulso, cardápio…): várias perguntas e tipos; uma resposta por pessoa, anonimato (a resposta não guarda quem respondeu) e resultado só com o mínimo de respostas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from '../../acessos/tests/ajuda.ts';
import { hashSenha } from '../../acessos/api/senha.ts';
import { MINIMO_RESPOSTAS } from '../api/index.ts';

const pergunta = (p: object = {}) => ({ pergunta: 'Como você se sentiu no trabalho esta semana?', status: 'aberto', ...p });

test('várias pesquisas abertas; cada pessoa responde uma vez; a resposta não guarda quem respondeu', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  assert.deepEqual((await app.inject({ url: '/api/pulso', headers: le })).json(), { aberto: false });
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: le, payload: pergunta() })).statusCode, 403);

  const a = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta() })).json<{ id: number }>();
  const b = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Você recomendaria a empresa como lugar para trabalhar?' }) })).json<{ id: number }>();
  assert.equal((db.prepare("SELECT COUNT(*) n FROM pulsos WHERE status = 'aberto'").get() as { n: number }).n, 2); // as duas ficam abertas

  const atual = (await app.inject({ url: '/api/pulso', headers: le })).json<{ aberto: boolean; id: number; perguntas: { id: number; tipo: string }[] }>();
  assert.deepEqual([atual.aberto, atual.id, atual.perguntas[0].tipo], [true, b.id, 'nota']); // sem lista de perguntas: uma nota com o próprio título
  const q = atual.perguntas[0].id;
  const responder = (id: number, h: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload });
  assert.equal((await responder(b.id, le, { respostas: [{ pergunta_id: q, valor: 9 }] })).statusCode, 400);
  assert.equal((await responder(b.id, le, { respostas: [] })).statusCode, 400); // obrigatória
  assert.equal((await responder(b.id, le, { respostas: [{ pergunta_id: q, valor: 4, comentario: 'Tudo bem.' }] })).statusCode, 200);
  assert.equal((await responder(b.id, le, { nota: 5 })).statusCode, 409);
  assert.equal((await app.inject({ url: '/api/pulso', headers: le })).json<{ id: number }>().id, a.id); // sobrou a outra pesquisa
  assert.equal((await responder(a.id, le, { nota: 3 })).statusCode, 200); // formato antigo ainda vale
  assert.deepEqual((await app.inject({ url: '/api/pulso', headers: le })).json(), { aberto: false });

  // anonimato: nenhuma coluna da resposta liga a pessoa
  const colunas = (db.prepare('PRAGMA table_info(pulso_respostas_item)').all() as { name: string }[]).map((c) => c.name);
  assert.deepEqual(colunas, ['id', 'pulso_id', 'pergunta_id', 'valor', 'comentario', 'dia', 'usuario_id']);
});

test('pesquisa com vários tipos de pergunta e imagem: valida, apura sem identificar ninguém e trava as perguntas depois da primeira resposta', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const hash = hashSenha(SENHA);
  const perguntas = [
    { texto: 'Qual cardápio você prefere?', tipo: 'unica', imagem: '/api/imagens/cardapio.png', opcoes: [{ texto: 'Churrasco', imagem: '/api/imagens/a.png' }, { texto: 'Massas' }, { texto: 'Executivo' }] },
    { texto: 'Quais atrações você quer?', tipo: 'multipla', opcoes: [{ texto: 'Banda' }, { texto: 'DJ' }, { texto: 'Sorteio' }] },
    { texto: 'De 1 a 5, o quanto você quer a festa?', tipo: 'nota' },
    { texto: 'Sugestões', tipo: 'texto', obrigatoria: false },
  ];
  const novo = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta(p) });
  assert.equal((await novo({ perguntas: [{ texto: 'Escolha', tipo: 'unica', opcoes: [{ texto: 'Só uma' }] }] })).statusCode, 400); // mínimo 2 opções
  assert.equal((await novo({ perguntas: [{ texto: 'Escolha', tipo: 'unica', imagem: 'http://externo.com/x.png', opcoes: [{ texto: 'A' }, { texto: 'B' }] }] })).statusCode, 400); // imagem só do portal
  assert.equal((await novo({ perguntas: [] })).statusCode, 400);
  const { id } = (await novo({ pergunta: 'Festa de final de ano', descricao: 'Ajude a escolher.', perguntas })).json<{ id: number }>();
  const lista = (await app.inject({ url: '/api/gestao/pulso', headers: ed })).json<{ n_perguntas: number; perguntas: { texto: string; imagem: string | null }[] }[]>();
  assert.equal(lista[0].n_perguntas, 4);
  assert.equal(lista[0].perguntas[0].imagem, '/api/imagens/cardapio.png');

  const qs = (await app.inject({ url: '/api/pulso', headers: ed })).json<{ perguntas: { id: number }[] }>().perguntas.map((x) => x.id);
  const resp = (i: number) => ({
    respostas: [
      { pergunta_id: qs[0], valor: i < 3 ? 'Churrasco' : 'Massas' },
      { pergunta_id: qs[1], valores: i % 2 ? ['Banda', 'DJ'] : ['DJ'] },
      { pergunta_id: qs[2], valor: 4 },
      ...(i === 0 ? [{ pergunta_id: qs[3], valor: 'Mais música ao vivo' }] : []),
    ],
  });
  for (let i = 0; i < MINIMO_RESPOSTAS; i++) {
    db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, ?, 0, ?)').run(`p${i}`, `Pessoa ${i}`, hash, 'consulta', new Date().toISOString());
    const h = await entrar(app, `p${i}`);
    const r0 = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: ed })).json<{ liberado: boolean; respostas: number }>();
    assert.deepEqual([r0.liberado, r0.respostas], [false, i]);
    if (i === 0) {
      assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: { respostas: [{ pergunta_id: qs[0], valor: 'Sushi' }] } })).statusCode, 400); // opção inexistente
      assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: { respostas: [{ pergunta_id: qs[0], valor: 'Massas' }] } })).statusCode, 400); // faltam obrigatórias
    }
    assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: resp(i) })).statusCode, 200);
  }
  type Res = { liberado: boolean; perguntas: { opcoes?: { texto: string; total: number }[]; media?: number; textos?: string[] }[] };
  const r = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: ed })).json<Res>();
  assert.equal(r.liberado, true);
  assert.deepEqual(r.perguntas[0].opcoes!.map((o) => [o.texto, o.total]), [['Churrasco', 3], ['Massas', 2], ['Executivo', 0]]);
  assert.deepEqual(r.perguntas[1].opcoes!.map((o) => [o.texto, o.total]), [['Banda', 2], ['DJ', 5], ['Sorteio', 0]]);
  assert.equal(r.perguntas[2].media, 4);
  assert.deepEqual(r.perguntas[3].textos, ['Mais música ao vivo']);

  // depois de respondida, as perguntas não mudam; título e situação continuam editáveis
  const mudou = perguntas.map((p, i) => (i === 0 ? { ...p, texto: 'Outro texto qualquer' } : p));
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${id}`, headers: ed, payload: pergunta({ perguntas: mudou }) })).statusCode, 409);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${id}`, headers: ed, payload: pergunta({ perguntas, status: 'encerrado' }) })).json<{ status: string }>().status, 'encerrado');
});

test('pesquisa identificada: guarda quem respondeu, mostra os nomes ao RH sem exigir mínimo e não troca de tipo depois de respondida; a anônima nunca guarda', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const perguntas = [{ texto: 'Qual cardápio você prefere?', tipo: 'unica', opcoes: [{ texto: 'Churrasco' }, { texto: 'Massas' }] }];
  const nova = (anonima: boolean) => app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: anonima ? 'Anônima' : 'Identificada', anonima, perguntas }) });
  const ident = (await nova(false)).json<{ id: number; anonima: number }>();
  const atual = (await app.inject({ url: '/api/pulso', headers: le })).json<{ id: number; anonima: boolean; perguntas: { id: number }[] }>();
  assert.deepEqual([atual.id, atual.anonima], [ident.id, false]); // quem responde é avisado
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${ident.id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: atual.perguntas[0].id, valor: 'Massas' }] } })).statusCode, 200);
  const r = (await app.inject({ url: `/api/gestao/pulso/${ident.id}/resultado`, headers: ed })).json<{ liberado: boolean; perguntas: { opcoes: { texto: string; nomes: string[] }[] }[] }>();
  assert.equal(r.liberado, true); // 1 resposta basta: o RH precisa saber quem votou
  assert.deepEqual(r.perguntas[0].opcoes.map((o) => [o.texto, o.nomes]), [['Churrasco', []], ['Massas', ['Leitor']]]);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${ident.id}`, headers: ed, payload: pergunta({ pergunta: 'Identificada', anonima: true, perguntas }) })).statusCode, 409);

  const anon = (await nova(true)).json<{ id: number }>();
  const q2 = (await app.inject({ url: '/api/pulso', headers: ed })).json<{ perguntas: { id: number }[] }>().perguntas[0].id;
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${anon.id}/responder`, headers: ed, payload: { respostas: [{ pergunta_id: q2, valor: 'Massas' }] } })).statusCode, 200);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM pulso_respostas_item WHERE pulso_id = ? AND usuario_id IS NOT NULL').get(anon.id) as { n: number }).n, 0);
  assert.equal((await app.inject({ url: `/api/gestao/pulso/${anon.id}/resultado`, headers: ed })).json<{ liberado: boolean }>().liberado, false);
});
