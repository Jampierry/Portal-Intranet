import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ titulo: 'Política de exemplo', categoria: 'Institucional', resumo: 'Resumo', formato: 'PDF', ...p });

test('editor cria documento com versão, responsável e link; leitor só lê', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ versao: '9.9', responsavel: 'Outra pessoa', link_oficial: 'https://exemplo.com.br/doc.pdf', revisado_em: '2026-10-01' }) });
  assert.equal(r.statusCode, 201);
  const le = await entrar(app, 'le');
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ titulo: string; versao: string; link_oficial: string }[]>();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].versao, '1.0', 'a versão é automática: o que vem do formulário é ignorado');
  assert.notEqual((lista[0] as unknown as { responsavel: string }).responsavel, 'Outra pessoa', 'o responsável é quem publicou');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: le, payload: novo() })).statusCode, 403);
});

test('link do documento só aceita http/https (bloqueia javascript:)', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (link: string) => app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ link_oficial: link }) });
  assert.equal((await post('javascript:alert(1)')).statusCode, 400);
  assert.equal((await post('ftp://servidor/arquivo')).statusCode, 400);
  assert.equal((await post('não é url')).statusCode, 400);
  assert.equal((await post('https://ok.example/doc')).statusCode, 201);
});

test('documento restrito só aparece para editor e admin', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Aberto' }) });
  await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Sigiloso', classificacao: 'restrito' }) });
  const ver = async (login: string) => (await app.inject({ url: '/api/documentos', headers: await entrar(app, login) })).json<{ titulo: string }[]>().map((d) => d.titulo);
  assert.deepEqual(await ver('le'), ['Aberto']);
  assert.deepEqual((await ver('edita')).sort(), ['Aberto', 'Sigiloso']);
});

test('editar, apagar e 404', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const d = (await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo() })).json<{ id: number }>();
  const mesmo = await app.inject({ method: 'PUT', url: `/api/gestao/documentos/${d.id}`, headers: ed, payload: novo({ resumo: 'Outro resumo' }) });
  assert.equal(mesmo.json<{ versao: string }>().versao, '1.0', 'editar sem trocar o arquivo mantém a versão');
  const up = await app.inject({ method: 'PUT', url: `/api/gestao/documentos/${d.id}`, headers: ed, payload: novo({ link_oficial: 'https://exemplo.com.br/novo.pdf' }) });
  assert.equal(up.json<{ versao: string }>().versao, '2.0', 'trocar o arquivo ou o link sobe a versão');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/${d.id}`, headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/${d.id}`, headers: ed })).statusCode, 404);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/documentos/999', headers: ed, payload: novo() })).statusCode, 404);
});

test('documento na pasta do portal: serve o arquivo e bloqueia saída da pasta', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const raiz = mkdtempSync(join(tmpdir(), 'docs-'));
  mkdirSync(join(raiz, 'RH'));
  writeFileSync(join(raiz, 'RH', 'ferias.txt'), 'conteudo ok');
  writeFileSync(join(raiz, '..', 'segredo-fora.txt'), 'nao pode');
  process.env.DOCUMENTOS_PASTA = raiz;
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (origem: string, link: string, extra: object = {}) => app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ origem, link_oficial: link, ...extra }) });
  assert.equal((await post('pasta', '../segredo-fora.txt')).statusCode, 400);
  assert.equal((await post('pasta', 'C:/Windows/win.ini')).statusCode, 400);
  assert.equal((await post('s999', 'RH/ferias.txt')).statusCode, 400);
  assert.equal((await post('pasta', 'RH/ferias.txt', { titulo: 'Férias' })).statusCode, 201);
  assert.equal((await post('pasta', 'RH/nao-existe.txt', { titulo: 'Sumiu' })).statusCode, 201);
  const le = await entrar(app, 'le');
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ slug: string; titulo: string; origem: string; link_oficial: string }[]>();
  const ferias = lista.find((d) => d.titulo === 'Férias')!;
  assert.equal(ferias.link_oficial, `/api/documentos/${ferias.slug}/arquivo`);
  const r = await app.inject({ url: ferias.link_oficial, headers: le });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body, 'conteudo ok');
  assert.match(String(r.headers['content-disposition']), /^inline; filename\*=UTF-8''ferias\.txt/, 'texto abre direto');
  assert.match(String((await app.inject({ url: `${ferias.link_oficial}?baixar=1`, headers: le })).headers['content-disposition']), /^attachment/, '?baixar=1 força o download');
  assert.equal((await app.inject({ url: `/api/documentos/${lista.find((d) => d.titulo === 'Sumiu')!.slug}/arquivo`, headers: le })).statusCode, 404);
  assert.equal((await app.inject({ url: ferias.link_oficial })).statusCode, 401);
  const raizLista = (await app.inject({ url: '/api/gestao/documentos/pasta', headers: ed })).json<{ sub: string; itens: { nome: string; pasta: boolean }[] }>();
  assert.deepEqual(raizLista.itens, [{ nome: 'RH', pasta: true }]);
  const rh = (await app.inject({ url: '/api/gestao/documentos/pasta?sub=RH', headers: ed })).json<{ sub: string; itens: { nome: string }[] }>();
  assert.equal(rh.sub, 'RH');
  assert.deepEqual(rh.itens.map((i) => i.nome), ['ferias.txt']);
  assert.equal((await app.inject({ url: '/api/gestao/documentos/pasta?sub=..', headers: ed })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/gestao/documentos/pasta', headers: le })).statusCode, 403);
  delete process.env.DOCUMENTOS_PASTA;
});

test('origem cadastrada pelo administrador: publicador escolhe o arquivo e o portal entrega', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const raiz = mkdtempSync(join(tmpdir(), 'orig-'));
  mkdirSync(join(raiz, 'Politicas'));
  writeFileSync(join(raiz, 'Politicas', 'conduta.txt'), 'texto da origem');
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const ed = await entrar(app, 'edita');
  const le = await entrar(app, 'le');
  const cria = (h: Record<string, string>, caminho = raiz) => app.inject({ method: 'POST', url: '/api/gestao/documentos/origens', headers: h, payload: { nome: 'RH', caminho } });
  assert.equal((await cria(ed)).statusCode, 403);
  assert.equal((await cria(adm, 'relativo/x')).statusCode, 400);
  const id = (await cria(adm)).json<{ id: number }>().id;
  assert.equal((await cria(adm)).statusCode, 400); // nome repetido
  // Publicador vê só o nome; administrador vê o caminho.
  assert.deepEqual((await app.inject({ url: '/api/gestao/documentos/origens', headers: ed })).json(), [{ id, nome: 'RH' }]);
  assert.equal((await app.inject({ url: '/api/gestao/documentos/origens', headers: adm })).json<{ caminho: string }[]>()[0].caminho, raiz);
  const nav = (await app.inject({ url: `/api/gestao/documentos/pasta?origem=${id}&sub=Politicas`, headers: ed })).json<{ itens: { nome: string }[] }>();
  assert.deepEqual(nav.itens.map((i) => i.nome), ['conduta.txt']);
  assert.equal((await app.inject({ url: `/api/gestao/documentos/pasta?origem=${id}&sub=..`, headers: ed })).statusCode, 400);
  const doc = await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Conduta', origem: `s${id}`, link_oficial: 'Politicas/conduta.txt' }) });
  assert.equal(doc.statusCode, 201);
  assert.equal(doc.json<{ origem: string; origem_id: number }>().origem_id, id);
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ slug: string; link_oficial: string }[]>();
  const r = await app.inject({ url: lista[0].link_oficial, headers: le });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body, 'texto da origem');
  // Seletor de pasta do servidor: só administrador.
  const sel = (h: Record<string, string>, caminho: string) => app.inject({ url: `/api/gestao/documentos/origens/navegar?caminho=${encodeURIComponent(caminho)}`, headers: h });
  assert.equal((await sel(ed, raiz)).statusCode, 403);
  assert.deepEqual((await sel(adm, raiz)).json<{ pastas: { nome: string }[] }>().pastas.map((p) => p.nome), ['Politicas']);
  assert.equal((await sel(adm, 'relativo')).statusCode, 400);
  assert.ok((await app.inject({ url: '/api/gestao/documentos/origens/navegar', headers: adm })).json<{ pastas: unknown[] }>().pastas.length > 0);
  // Origem em uso não pode ser apagada.
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/origens/${id}`, headers: adm })).statusCode, 400);
});


test('envio de arquivo do computador vai para a pasta de documentos do portal sem sobrescrever e vira documento', async () => {
  const { mkdtempSync, readFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const raiz = join(mkdtempSync(join(tmpdir(), 'env-')), 'ainda-nao-existe'); // a pasta nasce sozinha
  process.env.DOCUMENTOS_PASTA = raiz;
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const le = await entrar(app, 'le');
  const PDF = Buffer.from('%PDF-1.4\nconteudo de teste\n');
  const enviar = (nome: string, corpo: Buffer, h = ed) => app.inject({ method: 'POST', url: `/api/gestao/documentos/arquivo?nome=${encodeURIComponent(nome)}`, headers: { ...h, 'content-type': 'application/x-documento' }, payload: corpo });
  const a = await enviar('Catálogo.pdf', PDF);
  assert.equal(a.statusCode, 201);
  assert.equal(a.json<{ caminho: string }>().caminho, 'Enviados/Catálogo.pdf');
  assert.equal(readFileSync(join(raiz, 'Enviados', 'Catálogo.pdf')).equals(PDF), true);
  assert.equal((await enviar('Catálogo.pdf', PDF)).json<{ caminho: string }>().caminho, 'Enviados/Catálogo (2).pdf', 'nome repetido não sobrescreve');
  assert.equal((await enviar('../../fuga.pdf', PDF)).json<{ caminho: string }>().caminho.startsWith('Enviados/'), true, 'caminho no nome é neutralizado');
  assert.equal(existsSync(join(raiz, '..', 'fuga.pdf')), false);
  assert.equal((await enviar('programa.exe', PDF)).statusCode, 400, 'tipo não aceito');
  assert.equal((await enviar('falso.pdf', Buffer.from('isto não é pdf'))).statusCode, 400, 'conteúdo conferido');
  assert.equal((await enviar('x.pdf', PDF, le)).statusCode, 403, 'quem só lê não envia');
  const doc = await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: { titulo: 'Catálogo enviado', categoria: 'Catálogos', resumo: 'Resumo', formato: 'PDF', origem: 'envio', link_oficial: 'Enviados/Catálogo.pdf' } });
  assert.equal(doc.statusCode, 201);
  assert.equal(doc.json<{ origem: string }>().origem, 'pasta');
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ link_oficial: string }[]>();
  const arq = await app.inject({ url: lista[0].link_oficial, headers: le });
  assert.equal(arq.statusCode, 200);
  assert.equal(arq.rawPayload.equals(PDF), true);
  delete process.env.DOCUMENTOS_PASTA;
});
