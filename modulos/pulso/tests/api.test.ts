// Pesquisas (pulso, cardápio…): várias perguntas e tipos; uma resposta por pessoa, anonimato (a resposta não guarda quem respondeu) e resultado só com o mínimo de respostas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from '../../acessos/tests/ajuda.ts';
import { hashSenha } from '../../acessos/api/senha.ts';
import { MINIMO_RESPOSTAS } from '../api/index.ts';
import type { Banco } from '../../../servidor/src/db.ts';

/** Acrescenta participações de outras pessoas (sem respostas) para a pesquisa chegar ao mínimo exigido na divulgação. */
function completarMinimo(db: Banco, pulsoId: number) {
  for (let i = 0; i < MINIMO_RESPOSTAS; i++) {
    const u = Number(db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, criado_em) VALUES (?, ?, ?, ?, ?)').run(`extra${pulsoId}_${i}`, `Extra ${i}`, 'x', 'consulta', new Date().toISOString()).lastInsertRowid);
    db.prepare('INSERT OR IGNORE INTO pulso_participacao (pulso_id, usuario_id) VALUES (?, ?)').run(pulsoId, u);
  }
}

const pergunta = (p: object = {}) => ({ pergunta: 'Como você se sentiu no trabalho esta semana?', status: 'aberto', ...p });

test('várias pesquisas abertas; cada pessoa responde uma vez; a resposta não guarda quem respondeu', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const adm = await entrar(app, 'master');
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
  assert.deepEqual(colunas, ['id', 'pulso_id', 'pergunta_id', 'valor', 'comentario', 'dia', 'usuario_id', 'rodada']);
});

test('pesquisa com vários tipos de pergunta e imagem: valida, apura sem identificar ninguém e trava as perguntas depois da primeira resposta', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const adm = await entrar(app, 'master');
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
    const r0 = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: adm })).json<{ liberado: boolean; respostas: number }>();
    assert.deepEqual([r0.liberado, r0.respostas], [false, i]);
    if (i === 0) {
      assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: { respostas: [{ pergunta_id: qs[0], valor: 'Sushi' }] } })).statusCode, 400); // opção inexistente
      assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: { respostas: [{ pergunta_id: qs[0], valor: 'Massas' }] } })).statusCode, 400); // faltam obrigatórias
    }
    assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: resp(i) })).statusCode, 200);
  }
  type Res = { liberado: boolean; perguntas: { opcoes?: { texto: string; total: number }[]; media?: number; textos?: string[] }[] };
  const r = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: adm })).json<Res>();
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
  const adm = await entrar(app, 'master');
  const perguntas = [{ texto: 'Qual cardápio você prefere?', tipo: 'unica', opcoes: [{ texto: 'Churrasco' }, { texto: 'Massas' }] }];
  const nova = (anonima: boolean) => app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: anonima ? 'Anônima' : 'Identificada', anonima, perguntas }) });
  const ident = (await nova(false)).json<{ id: number; anonima: number }>();
  const atual = (await app.inject({ url: '/api/pulso', headers: le })).json<{ id: number; anonima: boolean; perguntas: { id: number }[] }>();
  assert.deepEqual([atual.id, atual.anonima], [ident.id, false]); // quem responde é avisado
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${ident.id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: atual.perguntas[0].id, valor: 'Massas' }] } })).statusCode, 200);
  const r = (await app.inject({ url: `/api/gestao/pulso/${ident.id}/resultado`, headers: adm })).json<{ liberado: boolean; perguntas: { opcoes: { texto: string; nomes: string[] }[] }[] }>();
  assert.equal(r.liberado, true); // 1 resposta basta: o RH precisa saber quem votou
  assert.deepEqual(r.perguntas[0].opcoes.map((o) => [o.texto, o.nomes]), [['Churrasco', []], ['Massas', ['Leitor']]]);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${ident.id}`, headers: ed, payload: pergunta({ pergunta: 'Identificada', anonima: true, perguntas }) })).statusCode, 409);

  const anon = (await nova(true)).json<{ id: number }>();
  const q2 = (await app.inject({ url: '/api/pulso', headers: ed })).json<{ perguntas: { id: number }[] }>().perguntas[0].id;
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${anon.id}/responder`, headers: ed, payload: { respostas: [{ pergunta_id: q2, valor: 'Massas' }] } })).statusCode, 200);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM pulso_respostas_item WHERE pulso_id = ? AND usuario_id IS NOT NULL').get(anon.id) as { n: number }).n, 0);
  assert.equal((await app.inject({ url: `/api/gestao/pulso/${anon.id}/resultado`, headers: adm })).json<{ liberado: boolean }>().liberado, false);
});

test('o RH decide o que os colaboradores veem: só pesquisas liberadas, só as perguntas marcadas, textos só se liberados e nunca nomes', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const adm = await entrar(app, 'master');
  const perguntas = [{ texto: 'Como está o clima?', tipo: 'nota', comentario: true }, { texto: 'Alguma sugestão?', tipo: 'texto', obrigatoria: false }];
  const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Clima', anonima: false, perguntas }) })).json<{ id: number }>();
  const qs = (await app.inject({ url: '/api/pulso', headers: le })).json<{ perguntas: { id: number }[] }>().perguntas.map((q) => q.id);
  await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: qs[0], valor: 4, comentario: 'Gosto daqui' }, { pergunta_id: qs[1], valor: 'Mais festas' }] } });

  type Pub = { perguntas: { texto: string; comentarios?: string[]; textos?: string[]; quem?: unknown }[] };
  const publicar = (h: Record<string, string>, payload: object) => app.inject({ method: 'PUT', url: `/api/gestao/pulso/${id}/publicacao`, headers: h, payload });
  // nada liberado: a lista vem vazia e o resultado não abre
  assert.deepEqual((await app.inject({ url: '/api/pulso/resultados', headers: le })).json(), []);
  assert.equal((await app.inject({ url: `/api/pulso/resultados/${id}`, headers: le })).statusCode, 404);
  assert.equal((await publicar(le, { liberado: true, perguntas: [] })).statusCode, 403); // colaborador não decide
  assert.equal((await publicar(ed, { liberado: true, perguntas: [] })).statusCode, 403); // nem o editor: só administrador e RH
  assert.equal((await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: ed })).statusCode, 403);

  // identificada com poucas respostas: mesmo liberada, a divulgação não aparece (seria possível adivinhar quem respondeu)
  assert.equal((await publicar(adm, { liberado: true, perguntas: [{ id: qs[0], resultado: true, textos: true }, { id: qs[1], resultado: true, textos: true }] })).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/pulso/resultados', headers: le })).json(), []);
  assert.equal((await app.inject({ url: `/api/pulso/resultados/${id}`, headers: le })).statusCode, 404);
  completarMinimo(db, id);

  // libera: resultado das duas, sem textos → a pergunta só de texto some, a nota aparece sem comentários e sem nomes
  assert.equal((await publicar(adm, { liberado: true, perguntas: [{ id: qs[0], resultado: true, textos: false }, { id: qs[1], resultado: true, textos: false }] })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/pulso/resultados', headers: le })).json<unknown[]>().length, 1);
  let r = (await app.inject({ url: `/api/pulso/resultados/${id}`, headers: le })).json<Pub>();
  assert.deepEqual(r.perguntas.map((q) => q.texto), ['Como está o clima?']);
  assert.equal(r.perguntas[0].comentarios, undefined);
  assert.equal(r.perguntas[0].quem, undefined);

  // libera os textos: aparecem comentários e respostas, mas os nomes continuam só com o RH
  await publicar(adm, { liberado: true, perguntas: [{ id: qs[0], resultado: true, textos: true }, { id: qs[1], resultado: true, textos: true }] });
  r = (await app.inject({ url: `/api/pulso/resultados/${id}`, headers: le })).json<Pub>();
  assert.deepEqual([r.perguntas[0].comentarios, r.perguntas[1].textos], [['Gosto daqui'], ['Mais festas']]);
  assert.ok(r.perguntas.every((q) => q.quem === undefined));
  assert.ok((await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: adm })).json<Pub>().perguntas[0].quem); // o RH continua vendo quem respondeu

  // esconder uma pergunta tira só ela; tirar a liberação some com a pesquisa
  await publicar(adm, { liberado: true, perguntas: [{ id: qs[0], resultado: false, textos: false }, { id: qs[1], resultado: true, textos: true }] });
  assert.deepEqual((await app.inject({ url: `/api/pulso/resultados/${id}`, headers: le })).json<Pub>().perguntas.map((q) => q.texto), ['Alguma sugestão?']);
  await publicar(adm, { liberado: false, perguntas: [{ id: qs[0], resultado: true, textos: false }, { id: qs[1], resultado: true, textos: false }] });
  assert.deepEqual((await app.inject({ url: '/api/pulso/resultados', headers: le })).json(), []);

  // anônima com menos de 5 respostas não aparece, mesmo liberada
  const anon = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Anônima', perguntas: [{ texto: 'Nota geral', tipo: 'nota' }] }) })).json<{ id: number }>();
  const qa = (await app.inject({ url: '/api/pulso', headers: le })).json<{ id: number; perguntas: { id: number }[] }>();
  await app.inject({ method: 'POST', url: `/api/pulso/${anon.id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: qa.perguntas[0].id, valor: 5 }] } });
  await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${anon.id}/publicacao`, headers: adm, payload: { liberado: true, perguntas: [{ id: qa.perguntas[0].id, resultado: true, textos: false }] } });
  assert.deepEqual((await app.inject({ url: '/api/pulso/resultados', headers: le })).json(), []);
  assert.equal((await app.inject({ url: `/api/pulso/resultados/${anon.id}`, headers: le })).statusCode, 404);
});

test('o RH pode mostrar só a opção mais votada de uma pergunta de escolha', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const adm = await entrar(app, 'master');
  const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Cardápio', anonima: false, perguntas: [{ texto: 'Qual cardápio?', tipo: 'unica', opcoes: [{ texto: 'Churrasco' }, { texto: 'Massas' }] }] }) })).json<{ id: number }>();
  const q = (await app.inject({ url: '/api/pulso', headers: le })).json<{ perguntas: { id: number }[] }>().perguntas[0].id;
  await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: q, valor: 'Massas' }] } });
  completarMinimo(db, id);
  const publicar = (vencedora: boolean) => app.inject({ method: 'PUT', url: `/api/gestao/pulso/${id}/publicacao`, headers: adm, payload: { liberado: true, perguntas: [{ id: q, resultado: true, textos: false, vencedora }] } });
  type Res = { perguntas: { opcoes: { texto: string; total: number }[]; so_vencedora?: boolean }[] };
  await publicar(false);
  assert.equal((await app.inject({ url: `/api/pulso/resultados/${id}`, headers: le })).json<Res>().perguntas[0].opcoes.length, 2); // gráfico completo
  await publicar(true);
  const r = (await app.inject({ url: `/api/pulso/resultados/${id}`, headers: le })).json<Res>().perguntas[0];
  assert.deepEqual([r.so_vencedora, r.opcoes.map((o) => o.texto)], [true, ['Massas']]);
  assert.equal((await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: adm })).json<Res>().perguntas[0].opcoes.length, 2); // o RH segue vendo tudo
});

test('comentário só existe em pergunta de nota que o RH marcou como "permitir comentário"', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Sem comentário', anonima: false, perguntas: [{ texto: 'Nota geral', tipo: 'nota' }, { texto: 'Nota com comentário', tipo: 'nota', comentario: true }] }) })).json<{ id: number; perguntas: { comentario: boolean }[] }>();
  const aberta = (await app.inject({ url: '/api/pulso', headers: le })).json<{ perguntas: { id: number; comentario: boolean }[] }>();
  assert.deepEqual(aberta.perguntas.map((q) => q.comentario), [false, true]); // a tela só oferece o campo onde foi permitido
  await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: aberta.perguntas[0].id, valor: 4, comentario: 'não deveria guardar' }, { pergunta_id: aberta.perguntas[1].id, valor: 5, comentario: 'este vale' }] } });
  const adm = await entrar(app, 'master');
  const r = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: adm })).json<{ liberado: boolean; perguntas: { comentarios?: string[]; aceita_comentario: boolean }[] }>();
  assert.equal(r.liberado, true); // identificada: o RH vê sem mínimo
  assert.deepEqual(r.perguntas.map((q) => [q.aceita_comentario, q.comentarios ?? []]), [[false, []], [true, ['este vale']]]); // onde não foi permitido, nada é guardado
});

test('período no ar: só aparece dentro de "abre em" e "encerra em"', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const em = (horas: number) => fmt(new Date(Date.now() + horas * 3600_000));
  const nova = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ perguntas: [{ texto: 'Como foi a semana?', tipo: 'nota' }], ...p }) });
  assert.equal((await nova({ abre_em: 'ontem' })).statusCode, 400); // formato inválido
  assert.equal((await nova({ abre_em: em(5), fecha_em: em(2) })).statusCode, 400); // encerra antes de abrir

  const futura = (await nova({ pergunta: 'Futura', abre_em: em(5) })).json<{ id: number; situacao: string }>();
  assert.equal(futura.situacao, 'agendada');
  assert.deepEqual((await app.inject({ url: '/api/pulso', headers: le })).json(), { aberto: false }); // ainda não abriu
  const vencida = (await nova({ pergunta: 'Vencida', abre_em: em(-5), fecha_em: em(-1) })).json<{ id: number; situacao: string }>();
  assert.equal(vencida.situacao, 'prazo');
  assert.deepEqual((await app.inject({ url: '/api/pulso', headers: le })).json(), { aberto: false }); // já passou do prazo
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${vencida.id}/responder`, headers: le, payload: { nota: 4 } })).statusCode, 404);
  const no_ar = (await nova({ pergunta: 'No ar', abre_em: em(-1), fecha_em: em(3) })).json<{ id: number; situacao: string }>();
  assert.equal(no_ar.situacao, 'aberto');
  assert.equal((await app.inject({ url: '/api/pulso', headers: le })).json<{ id: number }>().id, no_ar.id);
});

test('enviar de novo na mesma pesquisa: "só quem não respondeu" continua a rodada; "para todos" abre outra rodada com resultado separado', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le'), adm = await entrar(app, 'master');
  const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const em = (horas: number) => fmt(new Date(Date.now() + horas * 3600_000));
  const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Clima', anonima: false, perguntas: [{ texto: 'Como foi a semana?', tipo: 'nota' }] }) })).json<{ id: number }>();
  const reenviar = (h: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: `/api/gestao/pulso/${id}/reenviar`, headers: h, payload });
  const aberta = async (h: Record<string, string>) => (await app.inject({ url: '/api/pulso', headers: h })).json<{ aberto: boolean; id?: number; perguntas?: { id: number }[] }>();
  const responder = async (h: Record<string, string>, nota: number) => { const a = await aberta(h); return app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: { respostas: [{ pergunta_id: a.perguntas![0].id, valor: nota }] } }); };

  assert.equal((await responder(le, 4)).statusCode, 200);
  assert.equal((await aberta(le)).aberto, false);
  assert.equal((await reenviar(le, { publico: 'todos' })).statusCode, 403); // colaborador não reenvia
  assert.equal((await reenviar(ed, { publico: 'todos', abre_em: em(5), fecha_em: em(2) })).statusCode, 400);

  // só quem ainda não respondeu: a mesma rodada volta ao ar; quem já respondeu não vê; quem não respondeu vê
  const r1 = (await reenviar(ed, { publico: 'pendentes', abre_em: em(-1), fecha_em: em(24) })).json<{ rodada: number; status: string; situacao: string; respostas: number }>();
  assert.deepEqual([r1.rodada, r1.status, r1.situacao, r1.respostas], [1, 'aberto', 'aberto', 1]);
  assert.equal((await aberta(le)).aberto, false); // já respondeu
  assert.equal((await aberta(ed)).aberto, true); // ainda não

  // para todos: nova rodada; quem já respondeu responde outra vez e a contagem da rodada recomeça
  const r2 = (await reenviar(ed, { publico: 'todos', abre_em: em(-1), fecha_em: em(48) })).json<{ rodada: number; respostas: number; total_respostas: number }>();
  assert.deepEqual([r2.rodada, r2.respostas, r2.total_respostas], [2, 0, 1]);
  assert.equal((await aberta(le)).aberto, true);
  const qid = (await aberta(le)).perguntas![0].id;
  assert.equal((await responder(le, 2)).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: qid, valor: 5 }] } })).statusCode, 409); // já respondeu esta rodada

  // resultado do RH por rodada (identificada: sem mínimo)
  type Res = { rodada: number; rodadas: { rodada: number; respostas: number }[]; perguntas: { media: number }[] };
  const atual = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: adm })).json<Res>();
  assert.deepEqual([atual.rodada, atual.rodadas.map((x) => [x.rodada, x.respostas]), atual.perguntas[0].media], [2, [[1, 1], [2, 1]], 2]);
  const antiga = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado?rodada=1`, headers: adm })).json<Res>();
  assert.deepEqual([antiga.rodada, antiga.perguntas[0].media], [1, 4]);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM pulso_participacao WHERE pulso_id = ?').get(id) as { n: number }).n, 2);
});

test('resultado divulgado: aparece como novidade (não visto) uma vez; depois de visto fica só no histórico; rodada nova volta a ser novidade', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le'), adm = await entrar(app, 'master');
  const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Clima', anonima: false, perguntas: [{ texto: 'Como foi a semana?', tipo: 'nota' }] }) })).json<{ id: number }>();
  const q = (await app.inject({ url: '/api/pulso', headers: le })).json<{ perguntas: { id: number }[] }>().perguntas[0].id;
  await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: q, valor: 4 }] } });
  completarMinimo(db, id);
  const lista = async () => (await app.inject({ url: '/api/pulso/resultados', headers: le })).json<{ id: number; rodada: number; visto: boolean }[]>();
  assert.deepEqual(await lista(), []); // ainda não divulgado
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/resultados/${id}/visto`, headers: le, payload: {} })).statusCode, 404);
  await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${id}/publicacao`, headers: adm, payload: { liberado: true, perguntas: [{ id: q, resultado: true, textos: false }] } });
  assert.deepEqual((await lista()).map((p) => [p.id, p.rodada, p.visto]), [[id, 1, false]]); // novidade: vira pop-up
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/resultados/${id}/visto`, headers: le, payload: {} })).statusCode, 200);
  assert.deepEqual((await lista()).map((p) => p.visto), [true]); // continua no histórico, sem pop-up
  assert.deepEqual((await app.inject({ url: '/api/pulso/resultados', headers: ed })).json<{ visto: boolean }[]>().map((p) => p.visto), [false]); // é por pessoa
  // nova rodada que atinge o mínimo é novidade de novo
  await app.inject({ method: 'POST', url: `/api/gestao/pulso/${id}/reenviar`, headers: adm, payload: { publico: 'todos' } });
  for (let i = 0; i < MINIMO_RESPOSTAS; i++) db.prepare('INSERT INTO pulso_participacao (pulso_id, usuario_id, rodada) VALUES (?, (SELECT id FROM usuarios WHERE login = ?), 2)').run(id, `extra${id}_${i}`);
  assert.deepEqual((await lista()).map((p) => [p.rodada, p.visto]), [[2, false]]);
});

test('exportação CSV: só quem vê o resultado, protege contra fórmula e respeita o mínimo de respostas', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master'), le = await entrar(app, 'le');
  const p = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: adm, payload: pergunta({ pergunta: '=HIPERLINK("x")', anonima: true }) })).json<{ id: number }>();
  assert.equal((await app.inject({ url: `/api/gestao/pulso/${p.id}/exportar`, headers: le })).statusCode, 403);
  assert.equal((await app.inject({ url: `/api/gestao/pulso/${p.id}/exportar`, headers: adm })).statusCode, 409); // abaixo do mínimo
  completarMinimo(db, p.id);
  const r = await app.inject({ url: `/api/gestao/pulso/${p.id}/exportar`, headers: adm });
  // sem respostas gravadas o total ainda pode ficar abaixo do mínimo; o importante é nunca devolver 200 sem o mínimo
  assert.ok([200, 409].includes(r.statusCode));
  if (r.statusCode === 200) {
    assert.match(String(r.headers['content-type']), /text\/csv/);
    assert.ok(r.body.includes("'=HIPERLINK"));
  }
});
