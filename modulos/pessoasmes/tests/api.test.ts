import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const dois = (n: number) => String(n).padStart(2, '0');
const hoje = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const outroMes = hoje.getMonth() + 1 === 12 ? 1 : hoje.getMonth() + 2;

test('só aparece quem está autorizado; aniversariantes do mês atual; novos dos últimos 30 dias', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject('/api/pessoas-do-mes')).statusCode, 401);
  const ed = await entrar(app, 'edita');
  const mes = hoje.getMonth() + 1;
  const a = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/aniversariantes', headers: ed, payload: { area: 'Costura', dia: 10, mes, autorizado: true, ...p } });
  assert.equal((await a({ nome: 'Pessoa Autorizada' })).statusCode, 201);
  await a({ nome: 'Sem Autorização', autorizado: false });
  await a({ nome: 'Outro Mês', mes: outroMes });
  const n = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/novos', headers: ed, payload: { area: 'Corte', entrada: diasAtras(3), autorizado: true, ...p } });
  assert.equal((await n({ nome: 'Novo Recente', mensagem: 'Boas-vindas!' })).statusCode, 201);
  await n({ nome: 'Novo Antigo', entrada: diasAtras(90) });
  await n({ nome: 'Novo Sem Autorização', autorizado: false });

  const r = (await app.inject({ url: '/api/pessoas-do-mes', headers: await entrar(app, 'le') })).json<{ aniversariantes: { nome: string; iniciais: string }[]; novos: { nome: string }[] }>();
  assert.deepEqual(r.aniversariantes.map((x) => x.nome), ['Pessoa Autorizada']);
  assert.equal(r.aniversariantes[0].iniciais, 'PA');
  assert.deepEqual(r.novos.map((x) => x.nome), ['Novo Recente']);
});

test('leitor não gerencia; validação de data e foto', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le'), ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aniversariantes', headers: le, payload: { nome: 'Fulano', area: 'RH', dia: 1, mes: 1 } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aniversariantes', headers: ed, payload: { nome: 'Fulano', area: 'RH', dia: 31, mes: 4 } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aniversariantes', headers: ed, payload: { nome: 'Fulano', area: 'RH', dia: 1, mes: 1, foto: 'https://externo/x.png' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/novos', headers: ed, payload: { nome: 'Fulano', area: 'RH', entrada: 'ontem' } })).statusCode, 400);
});

test('importação em lote exige a confirmação da autorização, atualiza repetidos e relata erros', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const imp = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/aniversariantes/importar', headers: ed, payload: p });
  const itens = [{ nome: 'Ana Souza', area: 'Costura', dia: 5, mes: 3 }, { nome: 'Bruno Lima', area: 'Corte', dia: 40, mes: 3 }];
  assert.equal((await imp({ itens })).statusCode, 400);
  const r1 = (await imp({ itens, autorizado: true })).json<{ novos: number; atualizados: number; total_erros: number }>();
  assert.deepEqual([r1.novos, r1.atualizados, r1.total_erros], [1, 0, 1]);
  const r2 = (await imp({ itens: [{ nome: 'Ana Souza', area: 'Acabamento', dia: 5, mes: 3 }], autorizado: true })).json<{ novos: number; atualizados: number }>();
  assert.deepEqual([r2.novos, r2.atualizados], [0, 1]);
  const lista = (await app.inject({ url: '/api/gestao/aniversariantes', headers: ed })).json<{ nome: string; area: string; autorizado: number }[]>();
  assert.equal(lista.length, 1);
  assert.deepEqual([lista[0].area, lista[0].autorizado], ['Acabamento', 1]);
});

test('tempo de casa: quem faz aniversário de admissão no mês, a partir de 1 ano; admissão futura é recusada; fundação da empresa valida a data', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), adm = await entrar(app, 'master');
  const mes = hoje.getMonth() + 1;
  const adms = (anos: number, m = mes) => `${hoje.getFullYear() - anos}-${dois(m)}-15`;
  const a = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/aniversariantes', headers: ed, payload: { area: 'Costura', dia: 2, mes: outroMes, autorizado: true, ...p } });
  assert.equal((await a({ nome: 'Cinco Anos', admissao: adms(5) })).statusCode, 201);
  await a({ nome: 'Recém Chegado', admissao: adms(0) }); // menos de 1 ano: não entra
  await a({ nome: 'Outro Mês', admissao: adms(3, outroMes) });
  await a({ nome: 'Sem Admissão' });
  await a({ nome: 'Sem Autorização', admissao: adms(2), autorizado: false });
  const r = (await app.inject({ url: '/api/pessoas-do-mes', headers: await entrar(app, 'le') })).json<{ casa: { nome: string; anos: number }[] }>();
  assert.deepEqual(r.casa.map((x) => [x.nome, x.anos]), [['Cinco Anos', 5]]);
  assert.equal((await a({ nome: 'Futuro', admissao: `${hoje.getFullYear() + 1}-01-01` })).statusCode, 400);

  const put = (corpo: object) => app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, 'content-type': 'application/json' }, payload: { nome: 'X', nome_portal: 'P', ...corpo } });
  assert.equal((await put({ fundacao: 'ontem' })).statusCode, 400);
  assert.equal((await put({ fundacao: '1999-03-12' })).json<{ fundacao: string }>().fundacao, '1999-03-12');
  assert.equal((await app.inject({ url: '/api/empresa' })).json<{ fundacao: string }>().fundacao, '1999-03-12');
  assert.equal((await put({})).json<{ fundacao: string | null }>().fundacao, null);
});

test('tempo de casa: só os anos escolhidos aparecem no mural; vazio mostra todos; só quem edita configura; valida os números', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const mes = hoje.getMonth() + 1;
  const a = (nome: string, anos: number) => app.inject({ method: 'POST', url: '/api/gestao/aniversariantes', headers: ed, payload: { nome, area: 'Costura', dia: 2, mes: outroMes, autorizado: true, admissao: `${hoje.getFullYear() - anos}-${dois(mes)}-15` } });
  for (const [n, anos] of [['Um Ano', 1], ['Tres Anos', 3], ['Cinco Anos', 5], ['Dez Anos', 10]] as const) assert.equal((await a(n, anos)).statusCode, 201);
  const casa = async () => (await app.inject({ url: '/api/pessoas-do-mes', headers: le })).json<{ casa: { nome: string }[] }>().casa.map((x) => x.nome).sort();
  const ordenado = async () => (await app.inject({ url: '/api/pessoas-do-mes', headers: le })).json<{ casa: { nome: string }[] }>().casa.map((x) => x.nome);
  assert.deepEqual(await ordenado(), ['Um Ano', 'Tres Anos', 'Cinco Anos', 'Dez Anos']); // menos tempo de casa primeiro
  assert.deepEqual(await casa(), ['Cinco Anos', 'Dez Anos', 'Tres Anos', 'Um Ano']); // sem configuração: todos
  const put = (anos: unknown, h = ed) => app.inject({ method: 'PUT', url: '/api/gestao/tempo-de-casa', headers: h, payload: { anos } });
  assert.equal((await put([1, 5, 10, 5])).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/gestao/tempo-de-casa', headers: ed })).json(), { anos: [1, 5, 10] });
  assert.deepEqual(await casa(), ['Cinco Anos', 'Dez Anos', 'Um Ano']);
  assert.equal((await put([0])).statusCode, 400);
  assert.equal((await put([1.5])).statusCode, 400);
  assert.equal((await put('x')).statusCode, 400);
  assert.equal((await put([5], le)).statusCode, 403);
  assert.equal((await put([])).statusCode, 200);
  assert.equal((await casa()).length, 4); // vazio volta a mostrar todos
});
