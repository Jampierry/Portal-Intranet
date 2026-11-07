# Estado e ponto de parada

**Atualizado em:** 2026-11-07 (tudo enviado ao GitHub; `main` = `357ac4b`)

## Onde estamos
- Portal Intranet Di Paula na stack do PREMIA: `web/` (Vite + React), `servidor/` (Fastify + SQLite), `infra/migracoes` (001 base, 002 portal, 003 acessos), `modulos/<nome>/{api,tests,data}`.
- **Login local** criado pelo admin master (perfis `admin`, `editor`, `consulta`), portal fechado, auditoria, bloqueio por tentativas, troca obrigatória da senha provisória.
- **Telas:** Início, Comunicados (lista + detalhe), Documentos, Pessoas (contatos por área), Ajuda (FAQ) e **Gestão** (abas: Comunicados, Documentos, Pessoas em destaque, Contatos, Aplicativos, Usuários, Auditoria). Aplicativos ficam na barra da direita e em Gestão › Aplicativos (sem item no menu esquerdo).
- **Visual:** estilo de tema **Di Paula** (padrão) + 5 estilos antigos, claro/escuro, modo compacto, barra superior universal com aviso da tela, Capa em cor no lugar de fotos.
- **Verificação:** `npm run typecheck` (web + servidor), `npm run build` e `npm test` (41 testes: API com banco em memória, contraste dos temas, regra de links) passam.

## Dados e imagens de demonstração (2026-11-07)
- `npm run demo` = gera imagens (`scripts/gerar-imagens-demo.mjs` → `web/public/demo/`, 12 capas e 12 avatares em SVG, abstratos, sem pessoas reais) + migra + seed + `servidor/src/cli/demo.ts` (13 comunicados em vários estados, 7 documentos, 5 destaques novos, usuários `ana.demo` (editor), `bruno.demo` e `carla.demo` (consulta), senha `demo12345`, contatos extras). Pode repetir sem duplicar; não roda em produção.
- Migração `004-imagens.sql`: `comunicados.imagem`. Campo "Imagem de capa" na Gestão; destaques usam `foto_aprovada` (exposta como `foto`).
- Falta conferir por screenshot as telas com as imagens.

## Ajustes de 2026-11-07 (tarde)
- Campo **Categoria** da Gestão virou seletor com "＋ Nova categoria…" (`Crud.tsx`, `SeletorComNova`), sem o popup nativo do `datalist`.
- **Imagem de capa**: botão "Escolher imagem…" (arquivo do computador ou de pasta da rede), com prévia e "Remover". Módulo novo `modulos/imagens` (`POST /api/gestao/imagens` para admin/editor, `GET /api/imagens/:nome` com login); só PNG/JPG/WebP/GIF até 5 MB, conferido pelos primeiros bytes (SVG recusado de propósito); arquivos em `dados-privados/imagens` (ou `PASTA_IMAGENS`). Campo removido de Documentos (a API não usa).
- Início: o bloco **Documentos recentes** termina na mesma linha dos Comunicados (`contain: size` na coluna da direita) e rola por dentro com barra fina; no celular/tablet volta ao normal.
- `MCP/` (zimbra-mcp, com token) entrou no `.gitignore`.
- Testes: 43. Conferência por screenshot (Playwright-core em pasta temporária + Edge): Início ok; demais telas e celular geradas, falta revisar.

## Menu reorganizado (2026-11-07)
- **Publicar** (editor/admin): Comunicados, Documentos, Colaboradores Destaque (antes "Pessoas em destaque", renomeado também no Início e na Ajuda), Contatos, Aplicativos. **Configurações** (só admin; antes "Gestão"): Usuários, Perfis, Auditoria. Menu: Publicar após Documentos; Configurações no fim.
- Aba **Perfis** é informativa (3 perfis fixos). Falta, se quiser, perfis editáveis.

## Ícone do aplicativo (2026-11-07)
- Migração `005-logo-aplicacao.sql`: `aplicacoes.logo` (endereço `/api/imagens/<nome>`). Cadastro (Publicar › Aplicativos › Cadastro): ao informar o endereço, o portal busca sozinho o favicon (`POST /api/gestao/aplicacoes/icone`, `modulos/aplicacoes/api/favicon.ts`: lê as tags `link rel=icon`, prefere apple-touch/PNG, ignora SVG, cai em `/favicon.ico`); botões "Buscar do aplicativo", "Escolher imagem…" e "Remover". Sem imagem vale o ícone padrão.
- Exibição: `web/src/aplicacoes/IconeApp.tsx` (barra da direita, catálogo); se a imagem falhar cai no ícone padrão. `imagens` agora aceita `.ico` e expõe `guardarImagem`.
- Limite: sistema que exige login ou certificado inválido pode não entregar o favicon (usar envio manual). Só admin chama; busca com limite de 6 s e 512 KB. Testes: 47.

## Banners, missão/visão/valores e colaborador destaque (2026-11-07)
- **Banners** (migração 006, `modulos/banners`): carrossel "Novidades da semana" no topo do Início; cadastro em Publicar › Banners (imagem, título, subtítulo, botão/link interno `#comunicados/slug` ou https, ordem, janela de datas). Sem banner ativo, aparece a faixa padrão. Gira a cada 6,5 s, pausa com mouse/foco/botão, respeita "reduzir movimento".
- **Missão, visão e valores** (migração 007, `modulos/institucional`): editável em Publicar › Missão, Visão e Valores (valores = um por linha, até 8). Aparece no Início à esquerda; some se tudo estiver vazio. Textos do demo são de exemplo: **trocar pelo texto oficial**.
- **Colaborador Destaque** (singular: é o título do reconhecimento e o bloco mostra 3 pessoas por vez, em páginas que deslizam com animação, giro automático de 7,2 s, setas, pontos e pausa): bloco compacto alinhado à direita, ao lado de missão/visão/valores. Renomeado no Início, Publicar e Ajuda.
- Início continua cabendo na altura da janela (testado de 1366×650 a 1920×950). Testes: 52.

## Topo do Início com 3 carrosséis (2026-11-07)
- Migração 008: `banners.posicao` (`principal` = grande à esquerda; `lateral1` e `lateral2` = os dois menores à direita). Em Publicar › Banners cada banner escolhe o carrossel; a ordem vale dentro dele. Giram juntos (um só relógio de 6,5 s); setas/pontos deslocam só aquele carrossel; um botão de pausa. Carrossel grande vazio = faixa padrão; sem laterais, o grande ocupa tudo; no celular só o grande aparece.
- Missão, visão e valores voltou a mostrar tudo junto (sem abas nem rolagem interna): se houver muitos valores o bloco cresce e a página rola. Abaixo de 1500 px de largura, missão e visão ficam uma sob a outra.
- Testes: 53.

## Como retomar
1. `git pull`, `npm install`, `npm run banco:migrar`, `npm run banco:seed`, `npm run dev` (site http://localhost:5174, API 3100).
2. Entrar com `admin / admin123` (editor: `editor / editor123`; consulta: `leitor / leitor123`) — só desenvolvimento, criados pelo seed.
3. Produção: `npm run admin:criar -- <login> "<Nome>"`, `NODE_ENV=production` e `ORIGENS_PERMITIDAS=<endereço público>`. Nunca usar as senhas de exemplo.

## Atenção
- Dados 100% fictícios (seed); canais de contato usam domínio `.invalid`. Trocar pelos reais pela Gestão antes de usar.
- Gestão no celular: as tabelas viram cartões com rótulo (atributo `data-rotulo` + CSS no fim do bloco de 860px de `portal.css`). Falta conferir por screenshot no celular real/emulado, e também Pessoas e Ajuda; e abrir por screenshot os formulários de cada aba da Gestão (o fluxo está coberto pelos testes de API, não por teste de interface).
- Sem fotos reais: `Capa.tsx` aceita `foto` quando houver imagens aprovadas.
- Detalhe do Windows: usar a ferramenta de escrita (ou script Python em arquivo) para editar arquivos grandes; heredocs com aspas quebram no shell.

## Próximos passos (ideias, em ordem sugerida)
1. ✅ Tabelas da Gestão viram cartões no celular (falta só conferir por screenshot).
2. Recuperação de senha por e-mail (exige guardar e-mail) ou SSO, se a TI oferecer.
3. Notificações de novos comunicados e confirmação de leitura de comunicados obrigatórios.
4. Anexos de documentos (com limite de tamanho e antivírus) ou manter só link oficial.
5. Teste de interface automático (Playwright) nas telas principais e nos 6 estilos.
6. Ver também `docs/melhorias-futuras.md` e `docs/roteiro-modulos.md`.

# Histórico (do mais antigo ao mais novo)
## Redesign visual (2026-11-06)
- Layout das imagens de `docs/origem-manus/design/` aplicado sobre os temas existentes (nenhuma cor nova): menu escuro com marca e "Aplicações web", topo claro com busca/tema/sino/avatar, Início (saudação, faixa "Novidades da semana", pessoas em destaque, comunicados, aplicações favoritas), Comunicados (destaque + grade + painel "Temas"), Aplicações e Documentos em cartões, abas fixas no celular.
- Trazido do PREMIA: avatares (galeria de 16 + iniciais) e janela "Meu perfil", cartão de usuário no menu, submenus flutuantes com hover no menu recolhido, sino com avisos (comunicados urgentes), pular para o conteúdo.
- Barra lateral direita de aplicativos recriada (`web/src/aplicacoes/Lancador.tsx`): recolhida = ícones dos favoritos com dica; aberta = abas Favoritos / Todos os apps com estrela; no celular vira gaveta pelo botão de apps do topo. As favoritas também aparecem no menu e no Início.
- Tela inicial vem do endereço (`#comunicados`, `#aplicacoes`, `#documentos`); Voltar do navegador funciona.
- CSS novo em `web/src/portal.css`; tokens de tema continuam em `estilo.css` (o teste de contraste lê só ele).
- Estilo novo **Di Paula** (`data-estilo=dipaula`, agora o padrão): menu carvão, fundo creme, ameixa de destaque, coral nos botões de chamada (coral um pouco mais escuro que o da imagem para passar no contraste). Tokens em `estilo.css`; passa no teste de contraste (claro e escuro). Conferido por screenshot no claro e no escuro.
- Modo compacto (bloco "Modo compacto" no fim de `portal.css`): fonte base 13px, menu 216px com rótulo "ESPAÇO DE TRABALHO", busca de 36px com selo ENTER, cartões/botões/abas/barra de aplicativos menores, comunicados do Início em linha (capa + texto). Referência: protótipo compacto anterior + telas de `docs/origem-manus/design`.
- Barra superior universal: levemente escurecida (tom do destaque; adaptada ao escuro), "Bem-vindo(a), nome" à esquerda, aviso da tela no meio (mapa `AVISOS` em `App.tsx`; os avisos saíram do corpo das telas), versão, busca à direita e ícones pequenos. Perfil saiu do menu lateral: fica só no avatar do topo.
- **Sem fotos**: capas são blocos de cor do tema (`web/src/Capa.tsx`, aceita `foto` quando houver URL).
- Verificado por screenshot (escuro): Início, Comunicados, celular. Conferido por screenshot: 6 estilos × claro/escuro (Início), menu recolhido (corrigido: só ícones), celular (Aplicações), Documentos, detalhe de comunicado.

## Módulos 4 e 5 (2026-11-06)
- Comunicados: detalhe pronto. API `GET /api/comunicados/:slug` (404 para rascunho/arquivado), tela com corpo em parágrafos e "Mais em <categoria>", endereço `#comunicados/<slug>` (os cartões são links; Voltar do navegador funciona).
- Documentos: versão, responsável e data de revisão (dados de exemplo no seed, só onde estavam vazios).
- Testes novos da API em `modulos/comunicados/tests/api.test.ts` (banco em memória); `npm test` agora roda também `modulos/*/tests`.
- Seed: roda de novo sem duplicar; preenche `corpo` e metadados só onde são nulos.

## Login e gestão (2026-11-06)
- **Login local**: admin master cria os usuários (Gestão › Usuários). Perfis `admin` / `editor` / `consulta`. Portal fechado: toda `/api` exige sessão (cookie httpOnly 12 h), exceto `/api/saude` e `/api/login`. Detalhes em `modulos/acessos/README.md`.
- Senha provisória + troca obrigatória no primeiro acesso; bloqueio após 5 falhas em 15 min; auditoria só de inclusão (Gestão › Auditoria); defesa de origem (`ORIGENS_PERMITIDAS`).
- **Gestão** (`web/src/gestao/`): comunicados (rascunho/publicado/arquivado, janela de exibição), documentos (link oficial, versão, responsável, classificação restrita), pessoas em destaque (exige consentimento), aplicações (admin), usuários e auditoria (admin). Abas por endereço: `#gestao/usuarios` etc.
- Início: a coluna da direita agora tem **Avisos importantes** (comunicados urgentes; some se não houver) e **Documentos recentes** (4 mais recentes por data de revisão). A coluna da direita acompanha a altura da esquerda (último cartão cresce até o mesmo limite). A seção "Aplicações favoritas" saiu (menu e barra de aplicativos já cobrem).
- Favoritos agora ficam no servidor, por usuário. Avatar escolhido fica no navegador, por login. Migração `003-acessos.sql`.
- Dev: `npm run banco:seed` cria admin/admin123, editor/editor123, leitor/leitor123. Produção: `npm run admin:criar -- <login> "<Nome>"`.
- Testes: 38 (API com banco em memória + contraste + links). `npm run typecheck` agora checa web e servidor.

## Pessoas e Ajuda (2026-11-07)
- **Pessoas** = contatos por área (`modulos/pessoas`, tabela `contatos`/`departamentos`): canal da área, sem dados pessoais. Gestão em Gestão › Contatos. Seed cria contatos de exemplo (domínio `.invalid`).
- **Ajuda** = perguntas frequentes em `web/src/ajuda/Ajuda.tsx` (texto fixo no código; se virar conteúdo editável, mover para o banco).
- Menu: Pessoas e Ajuda deixaram de ser "em breve".

## Aplicativos (2026-11-07)
- Saíram do menu esquerdo: a seção "Aplicações web" e o item "Aplicações". Os aplicativos agora ficam na **barra da direita** (favoritos e todos) e em **Gestão › Aplicativos** (catálogo para editor/admin; cadastro só admin). No celular, a aba "Aplicativos" do rodapé abre a barra. Endereço antigo `#aplicacoes` volta ao Início.


## Permissões por perfil e por usuário (+ foto e período do Colaborador Destaque)
- Catálogo em `modulos/acessos/api/permissoes.ts`: `ver.*` (comunicados, documentos, pessoas, ajuda) e `pub.*` (comunicados, banners, institucional, documentos, destaques, contatos, aplicativos). Configurações (usuários, perfis, auditoria) continua só do administrador.
- Migração 009: tabela `perfis_permissoes` (editor/consulta, editável) e `usuarios.permissoes` (JSON `{chave: true|false}`). Admin sempre tem tudo.
- Regra: ajuste do usuário (permitir/negar) vale por cima do perfil; sem ajuste, vale o perfil. Calculado a cada requisição (`usuarioDaSessao`), então mudanças valem na hora.
- API: `GET /api/perfis`, `PUT /api/perfis/:codigo`; usuários aceitam `permissoes` (POST/PUT) e devolvem `efetivas`. Rotas usam `exigirPerm('pub.x')`; leituras de comunicados/documentos/contatos exigem `ver.x`; documentos "restritos" aparecem para quem tem `pub.documentos`.
- Tela: Configurações › Perfis (matriz com caixas de seleção) e Usuários › Editar › "Permissões desta pessoa" (Seguir o perfil / Permitir / Negar). Menu, telas, abas de Publicar e blocos do Início respeitam as permissões.
- Colaborador Destaque: campo "Foto da pessoa" em Publicar (usa `foto_aprovada`) e selo do período (mês/ano) sobre a foto no Início.
- Testes: `modulos/acessos/tests/permissoes.test.ts`.

## Colaborador Destaque por mês e ano
- Migração 010: `destaques.mes` e `destaques.ano` (aproveita o rótulo antigo). Publicar › Colaborador Destaque agora pede **Mês** e **Ano** (não há mais "Mês/Ano" como tipo).
- Início: aba **Mês** = destaques do mês vigente (sem selo de período); aba **Ano** = todos os do ano atual, com selo "Mês/Ano" sobre a foto. Data vigente = a do navegador.
- Campo "Foto da pessoa" no cadastro (`foto_aprovada`). Testes em `modulos/inicio/tests/api.test.ts`.

## Calendário de datas importantes (menu) ligado ao zimbra-mcp
- Módulo `modulos/calendario/api`: `GET /api/calendario?mes=AAAA-MM` (login obrigatório) chama `GET /api/eventos` do serviço `MCP/zimbra-mcp` **pelo servidor** (token nunca vai ao navegador), com cache de 5 min; devolve só id/título/início/fim/dia_inteiro/local (sem organizador).
- Configuração (variáveis de ambiente do servidor do portal): `ZIMBRA_API_URL` (ex.: http://127.0.0.1:8765), `ZIMBRA_API_TOKEN` (o mesmo `ZIMBRA_API_TOKEN` do zimbra-mcp) e, opcional, `ZIMBRA_AGENDA` (filtra a agenda por nome). Sem elas, o calendário aparece com o aviso "Agenda ainda não conectada ao Zimbra".
- No zimbra-mcp: ligar o serviço **Agenda** e escolher a(s) agenda(s) da empresa; liberar o IP do portal em `ZIMBRA_API_IPS`. A agenda lida é a da conta de serviço (calendário da empresa, não o pessoal de cada usuário).
- Tela: `web/src/Calendario.tsx` no menu lateral (some com o menu recolhido e em janelas com menos de 780 px de altura). Dia com ponto = há data importante; clicar mostra a lista do dia.
- Testes: `modulos/calendario/tests/api.test.ts` (Zimbra simulado). Ainda não testado com o serviço real.

## Abas liberadas por perfil e por usuário
- Novas permissões `cfg.usuarios`, `cfg.perfis`, `cfg.auditoria` (abas de Configurações) além de `pub.*` (abas de Publicar; a aba Aplicativos agora também depende de `pub.aplicativos`). Padrão: só o administrador tem `cfg.*`.
- Quem não é administrador: não vê administradores, não cria/edita/redefine senha de admin, não edita o próprio cadastro e só concede permissões que ele mesmo tem (usuário e perfil) — sem escalar privilégio. Testes em `modulos/acessos/tests/permissoes.test.ts`.
- Não são abas de tela e ficam fora: Favoritos/Todos (barra de aplicativos) e Mês/Ano (Colaborador Destaque).

## Perfis personalizados e permissões por ação (tela e aba)
- Migrações 011 (perfis com nome; Administrador/Editor/Consulta = `sistema`) e 012 (chaves novas por ação; reseta os padrões de Editor/Consulta e limpa ajustes antigos de usuário).
- Chaves: `ver.<tela>` (+ `documentos.abrir`, `documentos.restritos`), `pub.<aba>.{ver,criar,editar,excluir}` (institucional: ver/editar), `cfg.usuarios.{ver,criar,editar,senha}`, `cfg.perfis.{ver,criar,editar,excluir}`, `cfg.auditoria.ver`. A primeira ação da área ("ver") é o portão: sem ela as outras não valem (`normalizar`).
- API de perfis: `GET/POST /api/perfis`, `PUT/DELETE /api/perfis/:codigo` (perfil do sistema não apaga nem renomeia; em uso não apaga). Não-admin só concede o que tem e nunca mexe em admin.
- Tela: Configurações › Perfis = lista (nome, código, resumo, nº de usuários) com Novo/Editar/Apagar; cada perfil tem grade por tela/aba com as ações. Usuários › Editar usa a mesma grade (ajustes só do usuário).
- Publicar: abas e botões Novo/Editar/Apagar seguem as ações (`PermissoesCtx` em `Crud.tsx`). Documentos sem `documentos.abrir` não recebem o link do servidor.
- Carrosséis do topo agora se chamam Esquerda (maior), Meio e Direita em Publicar › Banners.
- Calendário no menu: sempre visível (compacto em janela baixa), acima do lema do rodapé.
- Tabelas (Usuários, Perfis, Auditoria e todas as de Publicar): clicar no cabeçalho ordena (A→Z, Z→A, original). Hook `useOrdenacao` em `web/src/gestao/Ordenar.tsx`; `Coluna.ordem` opcional no Crud.
- Publicar › Aplicativos: botão alterna entre Catálogo (cartões) e Lista (tabela); lembra a escolha neste navegador. Criar/Editar/Excluir continuam travados por pub.aplicativos.criar/editar/excluir.
