// Aplicativos restritos liberados por perfil, com extras por usuário (a pessoa vê a soma dos dois).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const base = (slug: string, restrita: boolean) => ({ nome: slug.toUpperCase(), descricao: 'Teste', categoria: 'Teste', url: `https://${slug}.exemplo.invalid`, acesso: 'link', icone: 'apps', responsavel: 'TI', ativo: true, restrita });

test('o perfil libera apps restritos; extras por usuário somam; sem perfil nem extra, não vê', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  for (const [slug, restrita] of [['livre', false], ['rh', true], ['folha', true], ['extra', true]] as const)
    assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: { slug, ...base(slug, restrita) } })).statusCode, 201, slug);

  const nomes = async (h: Record<string, string>) => (await app.inject({ url: '/api/aplicacoes', headers: h })).json<{ slug: string }[]>().map((a) => a.slug).sort();
  const le = await entrar(app, 'le');
  assert.deepEqual((await nomes(le)).filter((s) => ['livre', 'rh', 'folha', 'extra'].includes(s)), ['livre']);

  // libera dois apps para o perfil "consulta"; quem tem o perfil passa a ver
  const lista = await app.inject({ url: '/api/aplicativos-restritos', headers: adm });
  assert.deepEqual(lista.json<{ slug: string }[]>().map((a) => a.slug).sort(), ['extra', 'folha', 'rh']);
  const put = await app.inject({ method: 'PUT', url: '/api/perfis/consulta/aplicativos', headers: adm, payload: { liberados: ['rh', 'folha', 'inexistente'] } });
  assert.equal(put.statusCode, 200);
  assert.deepEqual(put.json<{ liberados: string[] }>().liberados.sort(), ['folha', 'rh']);
  assert.deepEqual((await nomes(le)).filter((s) => ['livre', 'rh', 'folha', 'extra'].includes(s)), ['folha', 'livre', 'rh']);

  // extra só para este usuário
  const id = (db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
  const info = (await app.inject({ url: `/api/usuarios/${id}/aplicativos`, headers: adm })).json<{ doPerfil: string[]; liberados: string[] }>();
  assert.deepEqual(info.doPerfil.sort(), ['folha', 'rh']);
  await app.inject({ method: 'PUT', url: `/api/usuarios/${id}/aplicativos`, headers: adm, payload: { liberados: ['extra'] } });
  assert.deepEqual((await nomes(le)).filter((s) => ['livre', 'rh', 'folha', 'extra'].includes(s)), ['extra', 'folha', 'livre', 'rh']);

  // outro usuário do mesmo tipo de perfil (editor) não ganha nada por isso
  const ed = await entrar(app, 'edita');
  assert.deepEqual((await nomes(ed)).filter((s) => ['rh', 'folha', 'extra'].includes(s)), []);

  // tirar do perfil: some para quem só tinha pelo perfil; o extra pessoal continua
  await app.inject({ method: 'PUT', url: '/api/perfis/consulta/aplicativos', headers: adm, payload: { liberados: [] } });
  assert.deepEqual((await nomes(le)).filter((s) => ['livre', 'rh', 'folha', 'extra'].includes(s)), ['extra', 'livre']);
});

test('só quem edita perfis altera; administrador não tem lista; favoritos acompanham a perda de acesso', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: { slug: 'rh', ...base('rh', true) } });
  assert.equal((await app.inject({ method: 'PUT', url: '/api/perfis/consulta/aplicativos', headers: ed, payload: { liberados: ['rh'] } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/perfis/admin/aplicativos', headers: adm, payload: { liberados: ['rh'] } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/perfis/nao-existe/aplicativos', headers: adm, payload: { liberados: [] } })).statusCode, 404);

  await app.inject({ method: 'PUT', url: '/api/perfis/consulta/aplicativos', headers: adm, payload: { liberados: ['rh'] } });
  assert.equal((await app.inject({ method: 'PUT', url: '/api/favoritos/rh', headers: le })).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/favoritos', headers: le })).json(), ['rh']);
  await app.inject({ method: 'PUT', url: '/api/perfis/consulta/aplicativos', headers: adm, payload: { liberados: [] } });
  assert.deepEqual((await app.inject({ url: '/api/favoritos', headers: le })).json(), []);
});
