// Fluxo de aprovação: quem precisa de aprovação envia para o RH; aprovado sobe (portal) ou fica liberado (rede social); rejeitado volta com o motivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { definirEnviadorPush } from '../../push/api/index.ts';

const esperar = async (cond: () => boolean) => { for (let i = 0; i < 60 && !cond(); i++) await new Promise((r) => setTimeout(r, 25)); };
const comunicado = (p: object = {}) => ({ titulo: 'Campanha do agasalho', resumo: 'Doações até sexta.', categoria: 'Pessoas', prioridade: 'normal', status: 'publicado', ...p });
const inscricao = (n: string) => ({ endpoint: `https://push.exemplo.com/envio/${n}-aaaaaaaaaaaa`, keys: { p256dh: 'BPaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', auth: 'aaaaaaaaaaaaaaaaaaaaaa' } });

/** App de teste com um usuário do perfil "RH" (login "rh"), que já traz a permissão de decidir. */
async function comRH() {
  const t = await criarAppTeste();
  const agora = new Date().toISOString();
  t.db.prepare("INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) SELECT 'rh', 'Pessoa do RH', senha_hash, 'p-rh', 0, ? FROM usuarios WHERE login = 'edita'").run(agora);
  return t;
}

test('comunicado de quem precisa de aprovação vai para a fila; aprovado sobe no portal; rejeitado volta com o motivo', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh'), le = await entrar(app, 'le');
  db.prepare("UPDATE usuarios SET exige_aprovacao = 1 WHERE login = 'edita'").run();

  const c = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado() });
  assert.equal(c.statusCode, 201);
  const criado = c.json<{ id: number; status: string }>();
  assert.equal(criado.status, 'rascunho'); // não publicou direto
  assert.equal((await app.inject({ url: '/api/comunicados', headers: le })).json<unknown[]>().length, 0); // ninguém vê ainda

  // fila do RH
  const fila = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ id: number; tipo: string; solicitante: string; previa: { resumo: string } }[]>();
  assert.deepEqual(fila.map((a) => [a.tipo, a.solicitante, a.previa.resumo]), [['comunicado', 'Editora', 'Doações até sexta.']]);
  assert.equal((await app.inject({ url: '/api/aprovacoes', headers: ed })).statusCode, 403); // quem pede não vê a fila
  assert.equal((await app.inject({ method: 'POST', url: `/api/aprovacoes/${fila[0].id}/decidir`, headers: ed, payload: { aprovar: true } })).statusCode, 403);

  // rejeitar exige motivo; a pessoa vê o retorno
  assert.equal((await app.inject({ method: 'POST', url: `/api/aprovacoes/${fila[0].id}/decidir`, headers: rh, payload: { aprovar: false } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: `/api/aprovacoes/${fila[0].id}/decidir`, headers: rh, payload: { aprovar: false, motivo: 'Falta o prazo de entrega.' } })).statusCode, 200);
  let caixa = (await app.inject({ url: '/api/aprovacoes/caixa', headers: ed })).json<{ respostas: { status: string; motivo: string; decisor: string }[]; pendentes: unknown[] }>();
  assert.deepEqual([caixa.respostas[0].status, caixa.respostas[0].motivo, caixa.respostas[0].decisor, caixa.pendentes.length], ['rejeitado', 'Falta o prazo de entrega.', 'Pessoa do RH', 0]);
  const lista = (await app.inject({ url: '/api/gestao/comunicados', headers: ed })).json<{ aprovacao_status: string; aprovacao_motivo: string; status: string }[]>();
  assert.deepEqual([lista[0].status, lista[0].aprovacao_status, lista[0].aprovacao_motivo], ['rascunho', 'rejeitado', 'Falta o prazo de entrega.']);
  assert.equal((await app.inject({ method: 'POST', url: `/api/aprovacoes/${fila[0].id}/decidir`, headers: rh, payload: { aprovar: true } })).statusCode, 409); // já decidido

  // corrige e reenvia: novo pedido; aprovado → sobe no portal
  await app.inject({ method: 'PUT', url: `/api/gestao/comunicados/${criado.id}`, headers: ed, payload: comunicado({ resumo: 'Doações até sexta, às 17h.' }) });
  const fila2 = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ id: number }[]>();
  assert.equal(fila2.length, 1);
  assert.equal((await app.inject({ method: 'POST', url: `/api/aprovacoes/${fila2[0].id}/decidir`, headers: rh, payload: { aprovar: true } })).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/comunicados', headers: le })).json<{ titulo: string }[]>().map((x) => x.titulo), ['Campanha do agasalho']);
  caixa = (await app.inject({ url: '/api/aprovacoes/caixa', headers: ed })).json();
  assert.equal(caixa.respostas[0].status, 'aprovado');

  // quem NÃO precisa de aprovação publica direto
  db.prepare("UPDATE usuarios SET exige_aprovacao = 0 WHERE login = 'edita'").run();
  const direto = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Publicação direta' }) });
  assert.equal(direto.json<{ status: string }>().status, 'publicado');
});

test('aprovado dispara o push do comunicado e o retorno chega a quem pediu', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh'), le = await entrar(app, 'le');
  db.prepare("UPDATE usuarios SET exige_aprovacao = 1 WHERE login = 'edita'").run();
  const avisos: { endpoint: string; titulo: string }[] = [];
  definirEnviadorPush(async (sub, carga) => { avisos.push({ endpoint: sub.endpoint, titulo: (JSON.parse(carga) as { titulo: string }).titulo }); return { statusCode: 201 }; });
  try {
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: ed, payload: inscricao('ed') });
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: rh, payload: inscricao('rh') });
    await app.inject({ method: 'POST', url: '/api/push/inscrever', headers: le, payload: inscricao('le') });
    await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado() });
    await esperar(() => avisos.some((a) => a.titulo === 'Publicação aguardando aprovação'));
    assert.deepEqual(avisos.map((a) => [a.endpoint, a.titulo]), [[inscricao('rh').endpoint, 'Publicação aguardando aprovação']]); // só quem decide
    avisos.length = 0;
    const id = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ id: number }[]>()[0].id;
    await app.inject({ method: 'POST', url: `/api/aprovacoes/${id}/decidir`, headers: rh, payload: { aprovar: true } });
    await esperar(() => avisos.length >= 4);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(avisos.filter((a) => a.titulo === 'Novo comunicado: Campanha do agasalho').length, 3); // todos recebem o comunicado
    assert.ok(avisos.some((a) => a.titulo === 'Publicação aprovada' && a.endpoint === inscricao('ed').endpoint)); // e quem pediu recebe o retorno
  } finally { definirEnviadorPush(null); }
});

test('publicação para rede social: registra plataforma, vai para o RH, aprovada é marcada como publicada; rejeitada volta com o motivo', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh'), le = await entrar(app, 'le');
  db.prepare("UPDATE usuarios SET exige_aprovacao = 1 WHERE login = 'edita'").run();
  const nova = (p: object = {}) => app.inject({ method: 'POST', url: '/api/gestao/redes', headers: ed, payload: { plataforma: 'instagram', titulo: 'Dia do Cliente', legenda: 'Obrigado por escolher a gente!', data_prevista: '2026-11-20', ...p } });
  assert.equal((await nova({ plataforma: 'orkut' })).statusCode, 400);
  assert.equal((await nova({ link: 'javascript:alert(1)' })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/redes', headers: le, payload: {} })).statusCode, 403);
  const r = (await nova()).json<{ id: number; status: string; plataforma: string }>();
  assert.deepEqual([r.status, r.plataforma], ['rascunho', 'instagram']);

  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/redes/${r.id}/publicada`, headers: ed, payload: {} })).statusCode, 409); // ainda não aprovada
  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/redes/${r.id}/enviar`, headers: ed })).json<{ status: string }>().status, 'em_aprovacao');
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/redes/${r.id}`, headers: ed, payload: { plataforma: 'instagram', titulo: 'Mudou' } })).statusCode, 409); // na fila: não edita

  const fila = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ id: number; tipo: string; detalhe: string; previa: { plataforma_nome: string; legenda: string } }[]>();
  assert.deepEqual([fila[0].tipo, fila[0].detalhe, fila[0].previa.plataforma_nome, fila[0].previa.legenda], ['rede_social', 'instagram', 'Instagram', 'Obrigado por escolher a gente!']);

  // rejeitada: volta para quem criou com o motivo e pode ser corrigida e reenviada
  await app.inject({ method: 'POST', url: `/api/aprovacoes/${fila[0].id}/decidir`, headers: rh, payload: { aprovar: false, motivo: 'A legenda precisa citar a promoção.' } });
  const rej = (await app.inject({ url: '/api/gestao/redes', headers: ed })).json<{ status: string; motivo: string }[]>()[0];
  assert.deepEqual([rej.status, rej.motivo], ['rejeitada', 'A legenda precisa citar a promoção.']);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/redes/${r.id}`, headers: ed, payload: { plataforma: 'instagram', titulo: 'Dia do Cliente', legenda: 'Com 10% de desconto hoje!' } })).json<{ status: string }>().status, 'rascunho');
  await app.inject({ method: 'POST', url: `/api/gestao/redes/${r.id}/enviar`, headers: ed });
  const fila2 = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ id: number }[]>();
  await app.inject({ method: 'POST', url: `/api/aprovacoes/${fila2[0].id}/decidir`, headers: rh, payload: { aprovar: true } });
  assert.equal((await app.inject({ url: '/api/gestao/redes', headers: ed })).json<{ status: string }[]>()[0].status, 'aprovada');
  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/redes/${r.id}/publicada`, headers: ed, payload: { link_publicado: 'https://www.instagram.com/p/abc/' } })).json<{ status: string }>().status, 'publicada');

  // quem não precisa de aprovação: "enviar" já deixa aprovada
  db.prepare("UPDATE usuarios SET exige_aprovacao = 0 WHERE login = 'edita'").run();
  const r2 = (await nova({ titulo: 'Direto' })).json<{ id: number }>();
  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/redes/${r2.id}/enviar`, headers: ed })).json<{ status: string }>().status, 'aprovada');
});

test('cadastro do usuário guarda "precisa de aprovação"', async () => {
  const { app } = await comRH();
  const adm = await entrar(app, 'master');
  const u = (await app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: 'nova.pessoa', nome: 'Nova Pessoa', perfil: 'editor', senha: 'Senha-provisoria-9', exige_aprovacao: true } })).json<{ id: number; exige_aprovacao: number }>();
  assert.equal(u.exige_aprovacao, 1);
  const lista = (await app.inject({ url: '/api/usuarios', headers: adm })).json<{ login: string; exige_aprovacao: number }[]>();
  assert.equal(lista.find((x) => x.login === 'nova.pessoa')!.exige_aprovacao, 1);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${u.id}`, headers: adm, payload: { exige_aprovacao: false } })).json<{ exige_aprovacao: number }>().exige_aprovacao, 0);
});
