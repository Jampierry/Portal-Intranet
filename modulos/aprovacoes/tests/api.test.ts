// Fluxo de aprovação: quem precisa de aprovação envia para o RH; aprovado sobe (portal) ou fica liberado (rede social); rejeitado volta com o motivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { definirEnviadorPush } from '../../push/api/index.ts';

const esperar = async (cond: () => boolean) => { for (let i = 0; i < 60 && !cond(); i++) await new Promise((r) => setTimeout(r, 25)); };
const comunicado = (p: object = {}) => ({ titulo: 'Campanha do agasalho', resumo: 'Doações até sexta.', categoria: 'Pessoas', prioridade: 'normal', status: 'publicado', ...p });
const inscricao = (n: string) => ({ endpoint: `https://push.exemplo.com/envio/${n}-aaaaaaaaaaaa`, keys: { p256dh: 'BPaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', auth: 'aaaaaaaaaaaaaaaaaaaaaa' } });

/** Liga/desliga, no usuário "edita", a exigência de aprovação do RH nas abas (ajuste `pub.<aba>.aprovacao`). */
const exigir = (db: import('../../../servidor/src/db.ts').Banco, ligado: boolean, abas = ['comunicados', 'redes', 'banners', 'documentos']) =>
  db.prepare("UPDATE usuarios SET permissoes = ? WHERE login = 'edita'").run(ligado ? JSON.stringify(Object.fromEntries(abas.map((a) => [`pub.${a}.aprovacao`, true]))) : null);

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
  exigir(db, true);

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
  exigir(db, false);
  const direto = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Publicação direta' }) });
  assert.equal(direto.json<{ status: string }>().status, 'publicado');
});

test('aprovado dispara o push do comunicado e o retorno chega a quem pediu', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh'), le = await entrar(app, 'le');
  exigir(db, true);
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
  exigir(db, true);
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
  exigir(db, false);
  const r2 = (await nova({ titulo: 'Direto' })).json<{ id: number }>();
  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/redes/${r2.id}/enviar`, headers: ed })).json<{ status: string }>().status, 'aprovada');
});

test('a exigência de aprovação é definida por aba, nas permissões do usuário', async () => {
  const { app, db } = await comRH();
  const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita');
  // o administrador grava o ajuste ao criar o usuário; só vale na aba escolhida
  const u = await app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: 'nova.pessoa', nome: 'Nova Pessoa', perfil: 'editor', senha: 'Senha-provisoria-9', permissoes: { 'pub.documentos.aprovacao': true } } });
  assert.equal(u.statusCode, 201);
  assert.equal(u.json<{ permissoes: Record<string, boolean> }>().permissoes['pub.documentos.aprovacao'], true);
  // sem o ajuste, ninguém precisa (o perfil Editor não traz)
  assert.ok(!(await app.inject({ url: '/api/eu', headers: ed })).json<{ permissoes: string[] }>().permissoes.some((c) => c.endsWith('.aprovacao')));
  exigir(db, true, ['banners']);
  const dir = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Sai direto' }) });
  assert.equal(dir.json<{ status: string }>().status, 'publicado'); // comunicados não foi marcado
});

test('banner e documento de quem precisa de aprovação ficam ocultos até o RH aprovar', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh'), le = await entrar(app, 'le');
  exigir(db, true);
  const b = (await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: ed, payload: { titulo: 'Banner novo', posicao: 'principal', ativo: true } })).json<{ id: number; ativo: number }>();
  assert.equal(b.ativo, 0);
  const d = (await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: { titulo: 'Manual novo', resumo: 'Resumo do manual', categoria: 'RH', formato: 'PDF', classificacao: 'interno', origem: 'link', link_oficial: 'https://exemplo.com/manual.pdf' } })).json<{ id: number }>();
  assert.equal((await app.inject({ url: '/api/banners', headers: le })).json<unknown[]>().length, 0);
  assert.equal((await app.inject({ url: '/api/documentos', headers: le })).json<{ titulo: string }[]>().some((x) => x.titulo === 'Manual novo'), false);

  const fila = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ id: number; tipo: string }[]>();
  assert.deepEqual(fila.map((x) => x.tipo).sort(), ['banner', 'documento']);
  for (const p of fila) assert.equal((await app.inject({ method: 'POST', url: `/api/aprovacoes/${p.id}/decidir`, headers: rh, payload: { aprovar: true } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/banners', headers: le })).json<unknown[]>().length, 1);
  assert.equal((await app.inject({ url: '/api/documentos', headers: le })).json<{ titulo: string }[]>().some((x) => x.titulo === 'Manual novo'), true);
  assert.ok(d.id > 0);
});

test('o administrador nunca precisa de aprovação, mesmo com a permissão marcada', async () => {
  const { app, db } = await comRH();
  const adm = await entrar(app, 'master');
  db.prepare("UPDATE usuarios SET permissoes = ? WHERE login = 'master'").run(JSON.stringify({ 'pub.comunicados.aprovacao': true }));
  const c = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: adm, payload: comunicado({ titulo: 'Admin direto' }) });
  assert.equal(c.json<{ status: string }>().status, 'publicado');
});

test('publicação para rede social aceita anexos (PDF, SVG…) que o RH abre antes de aprovar; conteúdo falso é recusado', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh'), le = await entrar(app, 'le');
  exigir(db, true);
  const enviar = (nome: string, corpo: Buffer, h = ed) => app.inject({ method: 'POST', url: `/api/gestao/redes/anexos?nome=${encodeURIComponent(nome)}`, headers: { ...h, 'content-type': 'application/octet-stream' }, payload: corpo });

  assert.equal((await enviar('arte.pdf', Buffer.from('isto não é um pdf'))).statusCode, 400); // conteúdo não confere
  assert.equal((await enviar('programa.exe', Buffer.from('MZ....'))).statusCode, 400); // tipo não aceito
  assert.equal((await enviar('arte.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).statusCode, 400); // SVG com script
  assert.equal((await enviar('arte.pdf', Buffer.from('%PDF-1.4 conteudo'), le)).statusCode, 403); // sem permissão

  const pdf = (await enviar('Briefing da campanha.pdf', Buffer.from('%PDF-1.4 briefing'))).json<{ id: number }>();
  const svg = (await enviar('logo.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'))).json<{ id: number }>();
  assert.ok(pdf.id && svg.id);
  // solto (ainda não salvo na publicação): só quem enviou abre (miniatura do formulário)
  assert.equal((await app.inject({ url: `/api/redes/anexos/${pdf.id}`, headers: rh })).statusCode, 404);
  assert.equal((await app.inject({ url: `/api/redes/anexos/${pdf.id}`, headers: ed })).statusCode, 200);

  const criada = (await app.inject({ method: 'POST', url: '/api/gestao/redes', headers: ed, payload: { plataforma: 'instagram', titulo: 'Campanha com arquivos', anexos: [{ id: pdf.id }, { id: svg.id }] } })).json<{ id: number; anexos: { nome: string }[] }>();
  assert.deepEqual(criada.anexos.map((a) => a.nome), ['Briefing da campanha.pdf', 'logo.svg']);
  await app.inject({ method: 'POST', url: `/api/gestao/redes/${criada.id}/enviar`, headers: ed });

  // o RH vê os anexos na fila e abre o arquivo
  const fila = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ previa: { anexos: { id: number }[] } }[]>();
  assert.equal(fila[0].previa.anexos.length, 2);
  const aberto = await app.inject({ url: `/api/redes/anexos/${pdf.id}`, headers: rh });
  assert.equal(aberto.statusCode, 200);
  assert.equal(aberto.headers['content-type'], 'application/pdf');
  assert.match(String(aberto.headers['content-disposition']), /^inline; filename\*=UTF-8''Briefing/);
  assert.match(String((await app.inject({ url: `/api/redes/anexos/${svg.id}`, headers: rh })).headers['content-security-policy']), /sandbox/);
  assert.equal((await app.inject({ url: `/api/redes/anexos/${pdf.id}`, headers: le })).statusCode, 403); // quem não vê a aba nem decide não abre

  // rejeitada volta para edição: tirar um anexo da lista apaga o arquivo
  await app.inject({ method: 'POST', url: `/api/aprovacoes/${(fila as unknown as { id: number }[])[0].id}/decidir`, headers: rh, payload: { aprovar: false, motivo: 'Troque a arte' } });
  const nova = (await app.inject({ method: 'PUT', url: `/api/gestao/redes/${criada.id}`, headers: ed, payload: { plataforma: 'instagram', titulo: 'Campanha com arquivos', anexos: [{ id: pdf.id }] } })).json<{ anexos: { id: number }[] }>();
  assert.deepEqual(nova.anexos.map((a) => a.id), [pdf.id]);
  assert.equal((await app.inject({ url: `/api/redes/anexos/${svg.id}`, headers: rh })).statusCode, 404);
});

test('mudar a data de uma publicação aprovada devolve para a aprovação do RH (quem precisa de aprovação)', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh');
  exigir(db, true);
  const r = (await app.inject({ method: 'POST', url: '/api/gestao/redes', headers: ed, payload: { plataforma: 'instagram', titulo: 'Campanha', data_prevista: '2026-11-20' } })).json<{ id: number }>();
  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/redes/${r.id}/data`, headers: ed, payload: { data_prevista: '2026-11-25' } })).statusCode, 409); // ainda não aprovada
  await app.inject({ method: 'POST', url: `/api/gestao/redes/${r.id}/enviar`, headers: ed });
  const pedido = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ id: number }[]>()[0];
  await app.inject({ method: 'POST', url: `/api/aprovacoes/${pedido.id}/decidir`, headers: rh, payload: { aprovar: true } });

  const nova = await app.inject({ method: 'POST', url: `/api/gestao/redes/${r.id}/data`, headers: ed, payload: { data_prevista: '2026-11-25' } });
  assert.equal(nova.statusCode, 200);
  assert.deepEqual({ status: nova.json<{ status: string }>().status, data: nova.json<{ data_prevista: string }>().data_prevista }, { status: 'em_aprovacao', data: '2026-11-25' });
  const fila = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ titulo: string }[]>();
  assert.match(fila[0].titulo, /nova data: 25\/11\/2026/);

  // quem não precisa de aprovação só troca a data
  exigir(db, false);
  const r2 = (await app.inject({ method: 'POST', url: '/api/gestao/redes', headers: ed, payload: { plataforma: 'instagram', titulo: 'Direta' } })).json<{ id: number }>();
  await app.inject({ method: 'POST', url: `/api/gestao/redes/${r2.id}/enviar`, headers: ed });
  const direta = await app.inject({ method: 'POST', url: `/api/gestao/redes/${r2.id}/data`, headers: ed, payload: { data_prevista: '2026-12-01' } });
  assert.equal(direta.json<{ status: string }>().status, 'aprovada');
});

test('mudar a data de comunicado, banner e documento: quem precisa de aprovação volta para a fila; quem não precisa só troca a data', async () => {
  const { app, db } = await comRH();
  const ed = await entrar(app, 'edita'), rh = await entrar(app, 'rh'), le = await entrar(app, 'le');
  const dir = { 'content-type': 'application/json' };
  void dir;
  // criados sem exigência (já publicados)
  const c = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Comunicado datado' }) })).json<{ id: number }>();
  const b = (await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: ed, payload: { titulo: 'Banner datado', posicao: 'principal', ativo: true } })).json<{ id: number }>();
  const d = (await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: { titulo: 'Documento datado', resumo: 'Resumo do documento', categoria: 'RH', formato: 'PDF', classificacao: 'interno', origem: 'link', link_oficial: 'https://exemplo.com/doc.pdf' } })).json<{ id: number }>();
  const trocar = (area: string, id: number, h = ed) => app.inject({ method: 'POST', url: `/api/gestao/${area}/${id}/data`, headers: h, payload: { exibir_de: '2030-01-10' } });

  // sem exigência: só a data muda (e o item some até lá, pois a data é futura)
  assert.equal((await trocar('comunicados', c.id)).json<{ status: string; exibir_de: string }>().exibir_de, '2030-01-10');
  assert.equal((await trocar('banners', b.id)).statusCode, 200);
  assert.equal((await trocar('documentos', d.id)).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/documentos', headers: le })).json<{ titulo: string }[]>().some((x) => x.titulo === 'Documento datado'), false); // data futura
  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/documentos/${d.id}/data`, headers: ed, payload: {} })).statusCode, 400); // data obrigatória

  // com exigência: volta para a fila com a data nova no título
  exigir(db, true);
  const r = await trocar('comunicados', c.id);
  assert.equal(r.json<{ status: string }>().status, 'rascunho');
  assert.equal((await trocar('banners', b.id)).json<{ ativo: number }>().ativo, 0);
  assert.equal((await trocar('documentos', d.id)).statusCode, 200);
  const fila = (await app.inject({ url: '/api/aprovacoes?situacao=pendentes', headers: rh })).json<{ tipo: string; titulo: string }[]>();
  assert.deepEqual(fila.map((x) => x.tipo).sort(), ['banner', 'comunicado', 'documento']);
  assert.ok(fila.every((x) => /nova data: 10\/01\/2030/.test(x.titulo)));
  assert.equal((await trocar('banners', b.id, le)).statusCode, 403);
});
