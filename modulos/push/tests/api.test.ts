// Avisos push: inscrição por aparelho, envio (simulado) a quem pode receber, uma vez por evento, limpeza de aparelhos que saíram.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { definirEnviadorPush, enviarPush } from '../api/index.ts';

const esperar = async (cond: () => boolean) => { for (let i = 0; i < 60 && !cond(); i++) await new Promise((r) => setTimeout(r, 25)); };
const inscricao = (n: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}-aaaaaaaaaaaa`, keys: { p256dh: 'BPaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', auth: 'aaaaaaaaaaaaaaaaaaaaaa' } });
const comunicado = (p: object = {}) => ({ titulo: 'Simulado de evacuação', resumo: 'Quinta-feira, às 10h.', categoria: 'Segurança', prioridade: 'urgente', status: 'publicado', ...p });

test('inscrição por aparelho: valida, é da própria pessoa e some ao cancelar', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const chave = (await app.inject({ url: '/api/push/chave', headers: le })).json<{ chave: string }>().chave;
  assert.match(chave, /^[\w-]{80,}$/); // chave pública do servidor
  assert.equal((await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: { endpoint: 'http://inseguro.com/x', keys: {} } })).statusCode, 400);
  // Só serviços de push dos navegadores: endereço interno da rede (o servidor faria POST nele) é recusado.
  assert.equal((await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: { ...inscricao('x'), endpoint: 'https://servidor-interno.dipaula.local/envio/aaaaaaaaaaaa' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: inscricao('a') })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: inscricao('a') })).statusCode, 200); // mesmo aparelho: não duplica
  assert.equal((await app.inject({ url: '/api/push/meus', headers: le })).json<{ aparelhos: number }>().aparelhos, 1);
  await app.inject({ method: 'POST', url: '/api/push/cancelar', headers: le, payload: { endpoint: inscricao('a').endpoint } });
  assert.equal((await app.inject({ url: '/api/push/meus', headers: le })).json<{ aparelhos: number }>().aparelhos, 0);
});

test('comunicado publicado avisa por push uma vez só, quem tem aparelho e pode vê-lo; aparelho que saiu é removido', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const enviados: { endpoint: string; carga: { titulo: string; url: string } }[] = [];
  let estado = 201;
  definirEnviadorPush(async (sub, carga) => { enviados.push({ endpoint: sub.endpoint, carga: JSON.parse(carga) }); if (estado === 410) throw Object.assign(new Error('gone'), { statusCode: 410 }); return { statusCode: 201 }; });
  try {
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: inscricao('le') });
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: ed, payload: inscricao('ed') });
    const c = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado() });
    assert.equal(c.statusCode, 201);
    await esperar(() => enviados.length >= 2);
    assert.deepEqual(enviados.map((e) => e.endpoint).sort(), [inscricao('ed').endpoint, inscricao('le').endpoint]);
    assert.match(enviados[0].carga.titulo, /^URGENTE: Simulado/);
    assert.match(enviados[0].carga.url, /^\/#comunicados\//);
    // editar de novo não avisa outra vez
    const slug = c.json<{ slug: string }>().slug;
    await app.inject({ method: 'PUT', url: `/api/gestao/comunicados/${c.json<{ id: number }>().id}`, headers: ed, payload: comunicado({ resumo: 'Mudou a hora.' }) });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(enviados.length, 2);
    assert.ok(slug);
    // rascunho não avisa
    await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Ainda em preparo', status: 'rascunho' }) });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(enviados.length, 2);
    // aparelho que respondeu "gone" (410) é apagado
    estado = 410;
    const r = await enviarPush(db, 'todos', { titulo: 'Teste', corpo: 'x' });
    assert.deepEqual(r, { enviados: 0, removidos: 2 });
    assert.equal((db.prepare('SELECT COUNT(*) n FROM push_inscricoes').get() as { n: number }).n, 0);
  } finally { definirEnviadorPush(null); }
});

test('pesquisa que entra no ar e resultado divulgado avisam por push; a agendada só avisa na hora de abrir', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const titulos: string[] = [];
  definirEnviadorPush(async (_s, carga) => { titulos.push((JSON.parse(carga) as { titulo: string }).titulo); return { statusCode: 201 }; });
  try {
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: inscricao('p') });
    const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    const futura = fmt(new Date(Date.now() + 5 * 3600_000));
    const corpo = { perguntas: [{ texto: 'Como foi a semana?', tipo: 'nota' }], status: 'aberto' };
    await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: { pergunta: 'Agendada para depois', abre_em: futura, ...corpo } });
    await new Promise((r) => setTimeout(r, 120));
    assert.deepEqual(titulos, []); // ainda não abriu
    await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: { pergunta: 'Aberta agora', ...corpo } });
    await esperar(() => titulos.length >= 1);
    assert.deepEqual(titulos, ['Nova pesquisa']);
    // a pesquisa agendada chega na hora: o relógio do servidor (a cada minuto) chama avisarAberturas
    db.prepare("UPDATE pulsos SET abre_em = ? WHERE pergunta = 'Agendada para depois'").run(fmt(new Date(Date.now() - 60_000)));
    const { avisarAberturas } = await import('../../pulso/api/index.ts');
    await avisarAberturas(db);
    assert.deepEqual(titulos, ['Nova pesquisa', 'Nova pesquisa']);
    await avisarAberturas(db);
    assert.equal(titulos.length, 2); // uma vez só

  } finally { definirEnviadorPush(null); }
});

test('reenvio só para pendentes avisa apenas quem não respondeu; quem ativa o push depois recebe o aviso das pesquisas em vigência', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le'), adm = await entrar(app, 'master');
  const avisos: { endpoint: string; titulo: string }[] = [];
  definirEnviadorPush(async (sub, carga) => { avisos.push({ endpoint: sub.endpoint, titulo: (JSON.parse(carga) as { titulo: string }).titulo }); return { statusCode: 201 }; });
  try {
    const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: adm, payload: { pergunta: 'Clima', status: 'aberto', perguntas: [{ texto: 'Como foi a semana?', tipo: 'nota' }] } })).json<{ id: number }>();
    await new Promise((r) => setTimeout(r, 80));
    // o colaborador "le" responde; depois os dois ativam o push (aparelho novo, pesquisa já em vigência)
    const q = (await app.inject({ url: '/api/pulso', headers: le })).json<{ perguntas: { id: number }[] }>().perguntas[0].id;
    await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: le, payload: { respostas: [{ pergunta_id: q, valor: 4 }] } });
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: inscricao('le') });
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: ed, payload: inscricao('ed') });
    await esperar(() => avisos.length >= 1);
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual(avisos.map((a) => [a.endpoint, a.titulo]), [[inscricao('ed').endpoint, 'Pesquisa aguardando sua resposta']]); // só quem ainda não respondeu
    avisos.length = 0;
    // reenviar só para pendentes: avisa apenas o "ed" (o "le" já respondeu)
    await app.inject({ method: 'POST', url: `/api/gestao/pulso/${id}/reenviar`, headers: adm, payload: { publico: 'pendentes' } });
    await esperar(() => avisos.length >= 1);
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual(avisos.map((a) => [a.endpoint, a.titulo]), [[inscricao('ed').endpoint, 'Pesquisa aguardando sua resposta']]);
    avisos.length = 0;
    // reenviar para todos: avisa os dois
    await app.inject({ method: 'POST', url: `/api/gestao/pulso/${id}/reenviar`, headers: adm, payload: { publico: 'todos' } });
    await esperar(() => avisos.length >= 2);
    assert.deepEqual(avisos.map((a) => a.titulo), ['Pesquisa de novo', 'Pesquisa de novo']);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM push_inscricoes').get() as { n: number }).n, 2);
  } finally { definirEnviadorPush(null); }
});
