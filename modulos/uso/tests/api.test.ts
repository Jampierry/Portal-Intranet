// Uso do portal: registro de entradas e telas, painel por pessoa e por departamento, permissão, auditoria e prazo de guarda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { limparUsoAntigo } from '../api/registro.ts';

const UA_CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
interface Resumo { cadastrados: number; ativos: number; semAcesso: number; telas: { tela: string; acessos: number }[]; aparelhos: { aparelho: string }[]; departamentos: { nome: string; pessoas: number; ativos: number }[]; serie: { entradas: number; telas: number }[] }
interface Pessoas { pessoas: { login: string; departamento: string | null; entradas: number; telas: number; dias_ativos: number; aparelho: string | null; tela_preferida: string | null }[] }

test('login e telas viram eventos; a mesma tela em seguida conta uma vez; tela inválida é recusada', async () => {
  const { app, db } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const abrir = (tela: string) => app.inject({ method: 'POST', url: '/api/uso/tela', headers: { ...le, 'user-agent': UA_CELULAR }, payload: { tela } });
  assert.equal((await abrir('inicio')).statusCode, 200);
  assert.equal((await abrir('inicio')).statusCode, 200); // recarregou: não conta de novo
  assert.equal((await abrir('comunicados')).statusCode, 200);
  assert.equal((await abrir('Tela Inválida!')).statusCode, 400);
  const ev = db.prepare("SELECT tipo, tela FROM uso_eventos ORDER BY id").all() as { tipo: string; tela: string | null }[];
  assert.deepEqual(ev.map((e) => `${e.tipo}:${e.tela ?? ''}`), ['login:', 'tela:inicio', 'tela:comunicados']);
  assert.equal((await app.inject({ method: 'POST', url: '/api/uso/tela', payload: { tela: 'inicio' } })).statusCode, 401);
});

test('o painel exige cfg.uso.ver e mostra adoção, aparelhos, telas e departamentos', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  for (const tela of ['comunicados', 'documentos', 'comunicados']) await app.inject({ method: 'POST', url: '/api/uso/tela', headers: { ...le, 'user-agent': UA_CELULAR }, payload: { tela } });
  await app.inject({ method: 'POST', url: '/api/uso/tela', headers: ed, payload: { tela: 'documentos' } });

  for (const url of ['/api/gestao/uso/resumo', '/api/gestao/uso/pessoas']) {
    assert.equal((await app.inject({ url, headers: ed })).statusCode, 403, 'editor sem a permissão não vê');
    assert.equal((await app.inject({ url })).statusCode, 401);
  }

  // departamentos: cria um, atribui e confere o agrupamento
  const d = (await app.inject({ method: 'POST', url: '/api/departamentos', headers: adm, payload: { nome: 'Marketing' } })).json<{ id: number }>();
  const idLe = (db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${idLe}`, headers: adm, payload: { departamento_id: d.id } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${idLe}`, headers: adm, payload: { departamento_id: 9999 } })).statusCode, 400);

  const r = (await app.inject({ url: '/api/gestao/uso/resumo?dias=30', headers: adm })).json<Resumo>();
  assert.equal(r.cadastrados, 3);
  assert.equal(r.ativos, 3); // os três entraram (login)
  assert.equal(r.semAcesso, 0);
  assert.deepEqual(r.telas.map((t) => t.tela).sort(), ['comunicados', 'documentos']);
  assert.ok(r.aparelhos.some((a) => a.aparelho === 'celular'));
  assert.ok(r.aparelhos.some((a) => a.aparelho === 'computador'));
  const mkt = r.departamentos.find((x) => x.nome === 'Marketing')!;
  assert.deepEqual([mkt.pessoas, mkt.ativos], [1, 1]);
  assert.ok(r.departamentos.find((x) => x.nome === 'Sem departamento'));
  assert.equal(r.serie.reduce((s, x) => s + x.entradas, 0), 3);

  const p = (await app.inject({ url: '/api/gestao/uso/pessoas?dias=30', headers: adm })).json<Pessoas>();
  const leitor = p.pessoas.find((x) => x.login === 'le')!;
  assert.equal(leitor.departamento, 'Marketing');
  assert.equal(leitor.aparelho, 'celular');
  assert.equal(leitor.tela_preferida, 'comunicados');
  assert.equal(leitor.entradas, 1);
  assert.equal(leitor.dias_ativos, 1);
  // a consulta por pessoa fica na auditoria
  assert.equal((db.prepare("SELECT COUNT(*) n FROM auditoria WHERE acao = 'uso_consultado'").get() as { n: number }).n, 1);
});

test('quem nunca entrou aparece como sem acesso e a permissão pode ser dada a um perfil', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  // "le" nunca entra: ninguém fez login dele
  db.prepare("DELETE FROM uso_eventos").run();
  const r = (await app.inject({ url: '/api/gestao/uso/resumo', headers: adm })).json<Resumo>();
  assert.equal(r.ativos, 0);
  assert.equal(r.semAcesso, 3);
  const p = (await app.inject({ url: '/api/gestao/uso/pessoas', headers: adm })).json<Pessoas>();
  assert.ok(p.pessoas.every((x) => x.dias_ativos === 0));

  // perfil com "Ver a aba" de uso enxerga o painel
  const perfil = (await app.inject({ method: 'POST', url: '/api/perfis', headers: adm, payload: { nome: 'Gestão de uso', permissoes: ['cfg.uso.ver'] } })).json<{ codigo: string }>();
  db.prepare("UPDATE usuarios SET perfil = ? WHERE login = 'le'").run(perfil.codigo);
  const le = await entrar(app, 'le');
  assert.equal((await app.inject({ url: '/api/gestao/uso/resumo', headers: le })).statusCode, 200);
});

test('dados com mais de 12 meses são apagados', async () => {
  const { db } = await criarAppTeste();
  const id = (db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
  const ins = db.prepare("INSERT INTO uso_eventos (usuario_id, quando, dia, hora, tipo, tela, aparelho) VALUES (?, ?, ?, 9, 'tela', 'inicio', 'computador')");
  ins.run(id, '2020-01-01T09:00:00.000Z', '2020-01-01');
  const hoje = new Date(); const d = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  ins.run(id, hoje.toISOString(), d);
  assert.equal(limparUsoAntigo(db), 1);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM uso_eventos').get() as { n: number }).n, 1);
});

test('comunicados lidos × publicados e exportação CSV (com auditoria)', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master'), le = await entrar(app, 'le'), ed = await entrar(app, 'edita');
  const c1 = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: adm, payload: { titulo: 'Aviso geral', resumo: 'r', categoria: 'RH', status: 'publicado', exige_leitura: true } })).json<{ slug: string }>();
  await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: adm, payload: { titulo: 'Outro aviso', resumo: 'r', categoria: 'RH', status: 'publicado' } });
  assert.equal((await app.inject({ url: `/api/comunicados/${c1.slug}`, headers: le })).statusCode, 200); // abrir conta como leitura
  assert.equal((await app.inject({ method: 'POST', url: `/api/comunicados/${c1.slug}/confirmar`, headers: le })).statusCode, 200);

  const r = (await app.inject({ url: '/api/gestao/uso/resumo?dias=7', headers: adm })).json<{ comunicados: { publicados: number; esperadas: number; abriram: number; itens: { titulo: string; abriram: number; esperadas: number; confirmaram: number }[] } }>();
  assert.equal(r.comunicados.publicados, 2);
  const geral = r.comunicados.itens.find((i) => i.titulo === 'Aviso geral')!;
  assert.deepEqual([geral.abriram, geral.confirmaram], [1, 1]);
  assert.ok(geral.esperadas >= 2);
  assert.equal(r.comunicados.itens.find((i) => i.titulo === 'Outro aviso')!.abriram, 0);

  assert.equal((await app.inject({ url: '/api/gestao/uso/exportar?dias=7', headers: ed })).statusCode, 403);
  const csv = await app.inject({ url: '/api/gestao/uso/exportar?dias=7', headers: adm });
  assert.equal(csv.statusCode, 200);
  assert.match(String(csv.headers['content-type']), /text\/csv/);
  assert.match(csv.body, /Comunicados publicados no período/);
  assert.match(csv.body, /Aviso geral/);
  assert.match(csv.body, /Por pessoa/);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/uso/exportar-pdf', headers: adm, payload: { dias: 7 } })).statusCode, 200);
  const aud = db.prepare("SELECT acao FROM auditoria WHERE acao = 'uso_exportado'").all();
  assert.equal(aud.length, 2);
});
