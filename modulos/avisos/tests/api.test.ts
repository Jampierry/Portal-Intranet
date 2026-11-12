// Aviso de comunicado por e-mail: usa um "serviço Zimbra" falso (servidor local) e confere quem recebe, quando e uma vez só.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { gravarIntegracao } from '../../integracoes/api/zimbra.ts';

interface Chamada { para: string | string[]; assunto: string; mensagem: string; botao_link?: string }
function servicoFalso() {
  const chamadas: Chamada[] = [];
  const servidor: Server = createServer((req, resp) => {
    let corpo = '';
    req.on('data', (d) => { corpo += d; });
    req.on('end', () => { if (req.url === '/api/notificar') chamadas.push(JSON.parse(corpo) as Chamada); resp.setHeader('content-type', 'application/json'); resp.end(JSON.stringify({ enviados: 1 })); });
  });
  return new Promise<{ chamadas: Chamada[]; url: string; fechar: () => void }>((ok) => servidor.listen(0, '127.0.0.1', () => ok({ chamadas, url: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`, fechar: () => servidor.close() })));
}
const esperar = async (cond: () => boolean) => { for (let i = 0; i < 60 && !cond(); i++) await new Promise((r) => setTimeout(r, 25)); };
const comunicado = (p: object = {}) => ({ titulo: 'Simulado de evacuação', resumo: 'Quinta-feira, às 10h.', categoria: 'Segurança', prioridade: 'urgente', status: 'publicado', ...p });

test('avisa por e-mail só urgentes, uma vez, a quem tem e-mail, ligou os avisos e vê comunicados', async () => {
  const svc = await servicoFalso();
  try {
    const { app, db } = await criarAppTeste();
    gravarIntegracao(db, 'url', svc.url); gravarIntegracao(db, 'token', 'token-de-teste-com-16+');
    const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita');
    const defEmail = (login: string, email: string | null, avisos = 1) => db.prepare('UPDATE usuarios SET email = ?, avisos_email = ? WHERE login = ?').run(email, avisos, login);
    defEmail('master', 'master@exemplo.invalid'); defEmail('edita', 'edita@exemplo.invalid', 0); defEmail('le', 'le@exemplo.invalid');
    assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/avisos', headers: adm, payload: { ativo: true, so_urgentes: true, url_portal: 'https://portal.exemplo.invalid/' } })).statusCode, 200);

    const novo = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado() });
    assert.equal(novo.statusCode, 201);
    await esperar(() => svc.chamadas.length > 0);
    assert.equal(svc.chamadas.length, 1);
    const c = svc.chamadas[0];
    assert.deepEqual([...(c.para as string[])].sort(), ['le@exemplo.invalid', 'master@exemplo.invalid']); // edita desligou; os demais têm e-mail
    assert.match(c.assunto, /^URGENTE: /);
    assert.match(String(c.botao_link), /^https:\/\/portal\.exemplo\.invalid\/#comunicados\/simulado-de-evacuacao/);

    // editar o mesmo comunicado não manda de novo
    const id = novo.json<{ id: number }>().id;
    await app.inject({ method: 'PUT', url: `/api/gestao/comunicados/${id}`, headers: ed, payload: comunicado({ resumo: 'Mudou a hora.' }) });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(svc.chamadas.length, 1);

    // comunicado normal não avisa quando só os urgentes estão ligados; rascunho que vira publicado avisa quando for urgente
    await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Campanha do agasalho', prioridade: 'normal' }) });
    const rasc = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Janela de manutenção', status: 'rascunho' }) });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(svc.chamadas.length, 1);
    await app.inject({ method: 'PUT', url: `/api/gestao/comunicados/${rasc.json<{ id: number }>().id}`, headers: ed, payload: comunicado({ titulo: 'Janela de manutenção' }) });
    await esperar(() => svc.chamadas.length > 1);
    assert.equal(svc.chamadas.length, 2);

    // com "só urgentes" desligado, o normal também avisa
    await app.inject({ method: 'PUT', url: '/api/integracoes/avisos', headers: adm, payload: { ativo: true, so_urgentes: false, url_portal: '' } });
    await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado({ titulo: 'Novo refeitório', prioridade: 'normal' }) });
    await esperar(() => svc.chamadas.length > 2);
    assert.equal(svc.chamadas.length, 3);
    assert.equal(svc.chamadas[2].botao_link, undefined); // sem endereço do portal, sem botão
  } finally { svc.fechar(); }
});

test('desligado não envia; e-mail inválido é recusado; a pessoa liga e desliga os próprios avisos; só quem edita integrações configura', async () => {
  const svc = await servicoFalso();
  try {
    const { app, db } = await criarAppTeste();
    gravarIntegracao(db, 'url', svc.url); gravarIntegracao(db, 'token', 'token-de-teste-com-16+');
    const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
    db.prepare("UPDATE usuarios SET email = 'le@exemplo.invalid'").run();
    await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: comunicado() });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(svc.chamadas.length, 0); // avisos nascem desligados

    assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/avisos', headers: ed, payload: { ativo: true } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/avisos', headers: adm, payload: { ativo: true, url_portal: 'ftp://x' } })).statusCode, 400);
    const id = (db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
    assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${id}`, headers: adm, payload: { email: 'sem-arroba' } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${id}`, headers: adm, payload: { email: 'Novo@Exemplo.Invalid' } })).json<{ email: string }>().email, 'novo@exemplo.invalid');

    assert.deepEqual((await app.inject({ url: '/api/eu/avisos', headers: le })).json(), { email: 'novo@exemplo.invalid', avisos_email: 1 });
    assert.equal((await app.inject({ method: 'PUT', url: '/api/eu/avisos', headers: le, payload: { avisos_email: false } })).json<{ avisos_email: number }>().avisos_email, 0);
  } finally { svc.fechar(); }
});

test('sino: avisos abertos ou limpos ficam guardados por pessoa e valem em qualquer aparelho', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le'), ed = await entrar(app, 'edita');
  assert.deepEqual((await app.inject({ url: '/api/avisos/lidos', headers: le })).json(), { chaves: [] });
  assert.equal((await app.inject({ method: 'POST', url: '/api/avisos/lidos', headers: le, payload: { chaves: [] } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/avisos/lidos', headers: le, payload: { chaves: ['qualquer coisa'] } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/avisos/lidos', headers: le, payload: { chaves: ['urgente:simulado', 'resposta:7'] } })).statusCode, 200);
  await app.inject({ method: 'POST', url: '/api/avisos/lidos', headers: le, payload: { chaves: ['urgente:simulado'] } }); // repetir não duplica
  assert.deepEqual((await app.inject({ url: '/api/avisos/lidos', headers: le })).json<{ chaves: string[] }>().chaves.sort(), ['resposta:7', 'urgente:simulado']);
  assert.deepEqual((await app.inject({ url: '/api/avisos/lidos', headers: ed })).json(), { chaves: [] }); // é de cada pessoa
});
