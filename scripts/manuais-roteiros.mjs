// Roteiros dos prints dos manuais: o que fotografar e o que apontar em cada tela. Rodados por scripts/manuais-prints.mjs.
// Cada roteiro recebe { nova, entrar, menu, ir, tirar, BASE }. Marcas: { alvo: Locator, rotulo, lado }, onde `lado` é o lado
// do alvo em que a seta fica ('esq' | 'dir' | 'cima' | 'baixo'); `contorno: false` desenha só a seta.

const aba = (p, nome) => p.getByRole('tab', { name: nome });
const botao = (p, nome) => p.getByRole('button', { name: nome });

/** Roda cada captura isolada: se uma falhar, as outras continuam e o erro aparece no final. */
async function passos(lista) {
  const falhas = [];
  for (const [nome, fn] of lista) {
    try { await fn(); } catch (e) { falhas.push(`${nome}: ${String(e.message).split('\n')[0]}`); }
  }
  if (falhas.length) throw new Error(falhas.join(' | '));
}

export const roteiros = {
  async entrada({ nova, tirar, BASE }) {
    const p = await nova(1280, 720);
    await p.goto(BASE);
    await p.getByLabel('Login').waitFor();
    await tirar(p, 'entrada-login', [
      { alvo: p.getByLabel('Login'), rotulo: '1. Seu login', lado: 'esq' },
      { alvo: p.getByLabel('Senha', { exact: true }), rotulo: '2. Sua senha', lado: 'esq' },
      { alvo: botao(p, 'Entrar'), rotulo: '3. Entrar', lado: 'esq' },
      { alvo: botao(p, 'Esqueci minha senha'), rotulo: 'Esqueci a senha', lado: 'esq' },
    ]);
    await p.context().close();
  },

  async inicio({ nova, entrar, tirar }) {
    const p = await nova(1366, 768);
    await entrar(p);
    await passos([
      ['visao-geral', () => tirar(p, 'inicio-visao-geral', [
        { alvo: p.locator('aside.menu nav'), rotulo: 'Menu das telas', lado: 'dir' },
        { alvo: p.locator('.cal-menu'), rotulo: 'Calendário', lado: 'dir' },
        { alvo: p.locator('input[type=search]'), rotulo: 'Busca global', lado: 'baixo' },
        { alvo: p.locator('.lancador'), rotulo: 'Aplicativos', lado: 'esq' },
      ])],
      ['barra-superior', () => tirar(p, 'inicio-barra-superior', [
        { alvo: p.locator('input[type=search]'), rotulo: 'Busca global', lado: 'baixo' },
        { alvo: p.getByRole('button', { name: 'Aparência' }), rotulo: 'Temas', lado: 'baixo' },
        { alvo: p.getByRole('button', { name: 'Avisos', exact: true }), rotulo: 'Sino de avisos', lado: 'baixo' },
        { alvo: p.getByRole('button', { name: 'Minha conta' }), rotulo: 'Minha conta', lado: 'baixo' },
      ], { clip: { x: 0, y: 0, width: 1366, height: 150 } })],
      ['sino', async () => {
        await p.getByRole('button', { name: 'Avisos', exact: true }).click();
        await tirar(p, 'sino-avisos', [{ alvo: p.locator('.painel-avisos').first(), rotulo: 'Lista de avisos', lado: 'esq' }], { clip: { x: 700, y: 0, width: 666, height: 420 } });
        await p.keyboard.press('Escape'); await p.mouse.click(300, 400);
      }],
      ['temas', async () => {
        await p.getByRole('button', { name: 'Aparência' }).click();
        await tirar(p, 'temas-painel', [{ alvo: p.locator('.tema-painel').first(), rotulo: 'Modo, estilo e escala', lado: 'esq' }], { clip: { x: 700, y: 0, width: 666, height: 520 } });
        await p.keyboard.press('Escape'); await p.mouse.click(300, 400);
      }],
      ['menu-conta', async () => {
        await p.getByRole('button', { name: 'Minha conta' }).first().click();
        await tirar(p, 'menu-conta', [
          { alvo: p.getByRole('button', { name: /Meu perfil/ }), rotulo: 'Meu perfil', lado: 'esq' },
          { alvo: p.getByRole('button', { name: 'Sair do sistema' }), rotulo: 'Sair', lado: 'esq' },
        ], { clip: { x: 900, y: 0, width: 466, height: 420 } });
        await p.keyboard.press('Escape'); await p.mouse.click(300, 400);
      }],
      ['calendario-painel', async () => {
        if (!(await p.locator('.cal-menu .cal-dia').first().isVisible())) await p.locator('.cal-menu .cal-topo button').last().click();
        await p.locator('.cal-menu .cal-dia').nth(14).click();
        await tirar(p, 'calendario-painel-lateral', [
          { alvo: p.locator('.cal-voo-btn'), rotulo: 'Abre e fecha o painel', lado: 'baixo' },
          { alvo: p.locator('.cal-voo').first(), rotulo: 'Compromissos do dia', lado: 'dir' },
        ], { clip: { x: 0, y: 380, width: 820, height: 388 } });
      }],
    ]);
    await p.context().close();
  },

  async telas({ nova, entrar, ir, tirar }) {
    const p = await nova(1366, 768);
    await entrar(p);
    await passos([
      ['comunicados', async () => {
        await ir(p, 'Comunicados');
        await tirar(p, 'comunicados-lista', [
          { alvo: p.locator('#conteudo-principal input[type=search], #conteudo-principal input').first(), rotulo: 'Buscar', lado: 'baixo' },
          { alvo: p.locator('#conteudo-principal a, #conteudo-principal article').first(), rotulo: 'Abrir o comunicado', lado: 'dir' },
        ]);
      }],
      ['documentos', async () => {
        await ir(p, 'Documentos');
        await tirar(p, 'documentos-lista', [
          { alvo: p.locator('#conteudo-principal input').first(), rotulo: 'Buscar documento', lado: 'baixo' },
          { alvo: p.locator('#conteudo-principal a, #conteudo-principal button').filter({ hasText: /Abrir|link oficial/i }).first(), rotulo: 'Abrir pelo link oficial', lado: 'esq' },
        ]);
      }],
      ['contatos', async () => {
        await ir(p, 'Contatos');
        await tirar(p, 'contatos-lista', [{ alvo: p.locator('#conteudo-principal input').first(), rotulo: 'Buscar contato', lado: 'baixo' }]);
      }],
      ['pesquisas', async () => {
        await ir(p, 'Pesquisas');
        await tirar(p, 'pesquisas-tela', [{ alvo: p.locator('#conteudo-principal').first(), rotulo: 'Suas pesquisas', lado: 'dir', contorno: false }]);
      }],
      ['calendario', async () => {
        await ir(p, 'Calendário');
        await tirar(p, 'calendario-tela', [
          { alvo: p.locator('.calp-grade, .cal-grade').first(), rotulo: 'Dia com compromisso', lado: 'dir' },
        ]);
      }],
      ['apps', async () => {
        await p.locator('.lancador button').first().click();
        await tirar(p, 'aplicativos-aberto', [
          { alvo: p.locator('.lancador-lista .lancador-link').first(), rotulo: 'Abrir o aplicativo', lado: 'esq' },
          { alvo: p.locator('.lancador-item .icone-btn').first(), rotulo: 'Estrela: favoritar', lado: 'esq' },
        ], { clip: { x: 900, y: 0, width: 466, height: 768 } });
      }],
      ['ajuda', async () => {
        await ir(p, 'Ajuda');
        await tirar(p, 'ajuda-manuais', [{ alvo: p.getByRole('button', { name: 'Manuais do sistema' }), rotulo: 'Manuais do sistema', lado: 'baixo' }]);
      }],
    ]);
    await p.context().close();
  },

  async perfil({ nova, entrar, tirar }) {
    const p = await nova(1366, 768);
    await entrar(p);
    await p.getByRole('button', { name: 'Minha conta' }).first().click();
    await p.getByRole('button', { name: /Meu perfil/ }).click();
    await p.waitForTimeout(800);
    await tirar(p, 'meu-perfil', [{ alvo: p.locator('#conteudo-principal').first(), rotulo: 'Seus dados e preferências', lado: 'dir', contorno: false }]);
    await p.context().close();
  },

  async celular({ nova, entrar, tirar }) {
    const p = await nova(390, 780, true);
    await entrar(p);
    const abas = p.locator('.abas-mobile');
    await passos([
      ['abas', () => tirar(p, 'celular-abas', [
        { alvo: abas.getByRole('button', { name: 'Calendário' }), rotulo: 'Calendário', lado: 'cima' },
        { alvo: abas.getByRole('button', { name: 'Aplicativos' }), rotulo: 'Aplicativos', lado: 'cima' },
        { alvo: abas.getByRole('button', { name: 'Menu' }), rotulo: 'Menu', lado: 'cima' },
      ])],
      ['apps', async () => {
        await abas.getByRole('button', { name: 'Aplicativos' }).click();
        await tirar(p, 'celular-aplicativos', [{ alvo: p.locator('.lancador').first(), rotulo: 'Favoritos', lado: 'esq' }]);
      }],
    ]);
    await p.context().close();
  },

  async publicar({ nova, entrar, ir, tirar }) {
    const p = await nova(1366, 768);
    await entrar(p);
    await ir(p, 'Publicar');
    await passos([
      ['abas', () => tirar(p, 'publicar-abas', [
        { alvo: p.locator('.abas-gestao').first(), rotulo: 'Cada aba é um tipo de conteúdo', lado: 'baixo' },
        { alvo: botao(p, /^(\+ )?Nov[oa]/).first(), rotulo: 'Criar', lado: 'esq' },
      ])],
      ['comunicado-form', async () => {
        await botao(p, /^(\+ )?Novo/).first().click();
        await tirar(p, 'publicar-comunicado-form', [
          { alvo: p.locator('.janela label').filter({ hasText: /^Título/ }).first(), rotulo: '1. Título', lado: 'esq' },
          { alvo: p.locator('.janela label').filter({ hasText: /Prioridade/ }).first(), rotulo: '2. Urgente vai ao sino', lado: 'dir' },
          { alvo: p.locator('.janela label').filter({ hasText: /Situa/ }).first(), rotulo: '3. Rascunho ou publicado', lado: 'esq' },
          { alvo: p.locator('.janela label').filter({ hasText: /Exigir confirma/ }).first(), rotulo: '4. Leitura obrigatória', lado: 'esq' },
          { alvo: p.locator('.janela label').filter({ hasText: /Exibir até/ }).first(), rotulo: '5. Período de exibição', lado: 'dir' },
        ]);
        await p.keyboard.press('Escape');
      }],
      ['banners', async () => { await aba(p, /Banners/).click(); await tirar(p, 'publicar-banners', [{ alvo: botao(p, /^(\+ )?Novo/).first(), rotulo: 'Novo banner', lado: 'esq' }]); }],
      ['documentos', async () => { await aba(p, /^Documentos/).click(); await tirar(p, 'publicar-documentos', [{ alvo: botao(p, /^(\+ )?Novo/).first(), rotulo: 'Novo documento', lado: 'esq' }]); }],
      ['aplicativos', async () => { await aba(p, 'Aplicativos').click(); await tirar(p, 'publicar-aplicativos', [{ alvo: aba(p, 'Aplicativos'), rotulo: 'Cadastro dos aplicativos', lado: 'baixo' }]); }],
      ['redes', async () => { await aba(p, /Redes/).click(); await tirar(p, 'publicar-redes', [{ alvo: botao(p, /^(\+ )?Nov[ao]/).first(), rotulo: 'Nova publicação', lado: 'esq' }]); }],
    ]);
    await p.context().close();
  },

  async rh({ nova, entrar, ir, tirar }) {
    const p = await nova(1366, 768);
    await entrar(p);
    await ir(p, 'Publicar');
    await passos([
      ['aprovacoes', async () => {
        await aba(p, /Aprova/).click();
        await tirar(p, 'rh-aprovacoes', [
          { alvo: aba(p, 'Aguardando decisão'), rotulo: 'Fila', lado: 'baixo' },
          { alvo: aba(p, 'Histórico'), rotulo: 'Histórico', lado: 'baixo' },
        ]);
      }],
      ['pesquisas', async () => {
        await aba(p, 'Pesquisa de pulso').click();
        await tirar(p, 'rh-pesquisas', [{ alvo: botao(p, 'Nova pesquisa'), rotulo: 'Nova pesquisa', lado: 'esq' }]);
        await botao(p, 'Nova pesquisa').click();
        await tirar(p, 'rh-pesquisa-editor', [
          { alvo: p.locator('.janela label').filter({ hasText: /^Título/ }).first(), rotulo: '1. Título', lado: 'esq' },
          { alvo: p.locator('.janela label').filter({ hasText: /Tipo de pesquisa/ }).first(), rotulo: '2. Anônima ou identificada', lado: 'esq' },
          { alvo: p.locator('.janela label').filter({ hasText: /Abre em/ }).first(), rotulo: '3. Período (opcional)', lado: 'esq' },
          { alvo: botao(p, '+ Adicionar pergunta'), rotulo: '4. Adicionar perguntas', lado: 'esq' },
        ]);
        await p.keyboard.press('Escape');
      }],
      ['aniversariantes', async () => { await aba(p, /Aniversariantes/).click(); await tirar(p, 'rh-aniversariantes', [{ alvo: botao(p, /Importar/).first(), rotulo: 'Importar planilha', lado: 'esq' }]); }],
    ]);
    await p.context().close();
  },

  async admin({ nova, entrar, ir, tirar }) {
    const p = await nova(1366, 768);
    await entrar(p);
    await ir(p, 'Configurações');
    await passos([
      ['usuarios', () => tirar(p, 'admin-usuarios', [
        { alvo: botao(p, /^(\+ )?Novo/).first(), rotulo: 'Novo usuário', lado: 'esq' },
        { alvo: p.locator('.abas-gestao').first(), rotulo: 'Abas de Configurações', lado: 'baixo' },
      ])],
      ['perfis', async () => { await aba(p, /Perfis/).click(); await tirar(p, 'admin-perfis', [{ alvo: botao(p, /^(\+ )?Novo/).first(), rotulo: 'Novo perfil', lado: 'esq' }]); }],
      ['empresa', async () => { await aba(p, /Empresa/).click(); await tirar(p, 'admin-empresa', [{ alvo: p.locator('#conteudo-principal').first(), rotulo: 'Nome, logo e ícone', lado: 'dir', contorno: false }]); }],
      ['entrada', async () => { await aba(p, /Tela de entrada/).click(); await tirar(p, 'admin-entrada', [{ alvo: p.locator('#conteudo-principal').first(), rotulo: 'Fundo e textos do login', lado: 'dir', contorno: false }]); }],
      ['integracoes', async () => { await aba(p, /Integra/).click(); await tirar(p, 'admin-integracoes', [{ alvo: p.locator('#conteudo-principal').first(), rotulo: 'Serviço de e-mail e agenda', lado: 'dir', contorno: false }]); }],
      ['pastas', async () => { await aba(p, /Pastas/).click(); await tirar(p, 'admin-pastas', [{ alvo: botao(p, /^(\+ )?Nov[ao]/).first(), rotulo: 'Nova pasta', lado: 'esq' }]); }],
      ['auditoria', async () => { await aba(p, /Auditoria/).click(); await tirar(p, 'admin-auditoria', [{ alvo: p.locator('#conteudo-principal table').first(), rotulo: 'Quem fez o quê', lado: 'dir', contorno: false }]); }],
    ]);
    await p.context().close();
  },
};
