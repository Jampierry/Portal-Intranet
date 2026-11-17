// Envio de e-mail pelo SMTP do portal: usa um servidor SMTP falso (local, sem TLS) e confere remetente, destinatários e conteúdo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { gravarCalDav } from '../../integracoes/api/caldav.ts';
import { conexaoSmtp, montarEmail } from '../../integracoes/api/smtp.ts';

interface Recebido { de: string; para: string; dados: string }
function smtpFalso(senhaCerta = 'segredo') {
  const recebidos: Recebido[] = [];
  const servidor: Server = createServer((s: Socket) => {
    let de = '', para = '', dados = '', emDados = false, buf = '';
    s.write('220 falso ESMTP\r\n');
    s.on('data', (d) => {
      buf += d.toString('utf8');
      for (;;) {
        if (emDados) {
          const fim = buf.indexOf('\r\n.\r\n'); if (fim < 0) return;
          dados = buf.slice(0, fim); buf = buf.slice(fim + 5); emDados = false;
          recebidos.push({ de, para, dados }); s.write('250 ok\r\n'); continue;
        }
        const i = buf.indexOf('\r\n'); if (i < 0) return;
        const l = buf.slice(0, i); buf = buf.slice(i + 2);
        if (/^EHLO/i.test(l)) s.write('250-falso\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH PLAIN/i.test(l)) {
          const [, u, pw] = Buffer.from(l.split(' ')[2], 'base64').toString().split(String.fromCharCode(0));
          s.write(u && pw === senhaCerta ? '235 ok\r\n' : '535 5.7.8 recusado\r\n');
        }
        else if (/^MAIL FROM/i.test(l)) { de = l; s.write('250 ok\r\n'); }
        else if (/^RCPT TO/i.test(l)) { para = l; s.write('250 ok\r\n'); }
        else if (/^DATA/i.test(l)) { emDados = true; s.write('354 vai\r\n'); }
        else if (/^QUIT/i.test(l)) { s.write('221 tchau\r\n'); s.end(); }
        else s.write('250 ok\r\n');
      }
    });
  });
  return new Promise<{ recebidos: Recebido[]; porta: number; fechar: () => void }>((ok) => servidor.listen(0, '127.0.0.1', () => ok({ recebidos, porta: (servidor.address() as AddressInfo).port, fechar: () => servidor.close() })));
}

test('monta o e-mail com selo, categoria, aviso e botão, escapando o conteúdo e só aceitando link http(s)', () => {
  const m = montarEmail({ titulo: 'Aviso <b>', mensagem: 'Linha 1 & 2', app: 'Portal', etiqueta: 'Urgente', tom: 'urgente', categoria: 'Segurança', destaque: 'Exige confirmação de leitura.', botao_texto: 'Ler e confirmar', botao_link: 'https://portal.exemplo.invalid/#c' });
  assert.match(m.html, /Aviso &lt;b&gt;/); assert.match(m.html, /Linha 1 &amp; 2/); assert.match(m.html, /href="https:\/\/portal\.exemplo\.invalid\/#c"/);
  assert.match(m.html, /Urgente/); assert.match(m.html, /Segurança/); assert.match(m.html, /Exige confirmação/); assert.match(m.html, /#cf4a39/); // tom urgente
  assert.match(m.text, /Ler e confirmar: https:\/\/portal/); assert.match(m.text, /\[Urgente · Segurança\]/);
  assert.doesNotMatch(montarEmail({ titulo: 't', mensagem: 'm', app: 'P', botao_link: 'javascript:alert(1)' }).html, /href=/);
});

test('sem configuração não há envio; com CalDAV a mesma conta e o mesmo servidor valem para o SMTP', async () => {
  const { db } = await criarAppTeste();
  assert.equal(conexaoSmtp(db), null);
  gravarCalDav(db, 'url', 'https://correio.exemplo.invalid/dav/agenda@exemplo.invalid/Calendar'); gravarCalDav(db, 'usuario', 'agenda@exemplo.invalid'); gravarCalDav(db, 'senha', 'segredo');
  const c = conexaoSmtp(db)!;
  assert.deepEqual([c.host, c.porta, c.usuario, c.remetente, c.origem], ['correio.exemplo.invalid', 465, 'agenda@exemplo.invalid', 'agenda@exemplo.invalid', 'caldav']);
});

test('envia o e-mail de teste pelo SMTP configurado e traduz a recusa de senha', async () => {
  const smtp = await smtpFalso();
  try {
    const { app, db } = await criarAppTeste();
    const adm = await entrar(app, 'master');
    db.prepare('UPDATE usuarios SET email = ? WHERE login = ?').run('master@exemplo.invalid', 'master');
    assert.equal((await app.inject({ method: 'POST', url: '/api/integracoes/avisos/teste', headers: adm, payload: {} })).statusCode, 400); // sem servidor de e-mail
    const salvar = (senha: string) => app.inject({ method: 'PUT', url: '/api/integracoes/smtp', headers: adm, payload: { host: '127.0.0.1', porta: String(smtp.porta), usuario: 'avisos@exemplo.invalid', senha, remetente: 'avisos@exemplo.invalid' } });
    assert.equal((await salvar('errada')).statusCode, 200);
    const ruim = await app.inject({ method: 'POST', url: '/api/integracoes/avisos/teste', headers: adm, payload: {} });
    assert.equal(ruim.statusCode, 502); assert.match(ruim.json<{ erro: string }>().erro, /usuário ou a senha/);
    assert.equal((await salvar('segredo')).statusCode, 200);
    const ok = await app.inject({ method: 'POST', url: '/api/integracoes/avisos/teste', headers: adm, payload: {} });
    assert.equal(ok.statusCode, 200);
    assert.equal(smtp.recebidos.length, 1);
    assert.match(smtp.recebidos[0].de, /avisos@exemplo\.invalid/); assert.match(smtp.recebidos[0].para, /master@exemplo\.invalid/);
    assert.match(smtp.recebidos[0].dados, /Subject: Teste de aviso do portal/);
    const cfg = (await app.inject({ url: '/api/integracoes/smtp', headers: adm })).json<{ senha_salva: boolean; origem: string }>();
    assert.deepEqual([cfg.senha_salva, cfg.origem], [true, 'proprio']);
    assert.equal(JSON.stringify(cfg).includes('segredo'), false); // a senha nunca volta
  } finally { smtp.fechar(); }
});
