# Visão geral e arquitetura

## O que é
Portal interno responsivo (computador e celular) da Di Paula: comunicados, aplicativos (links), documentos, contatos, calendário, pesquisas e reconhecimento de pessoas. Login local obrigatório; o administrador cria os usuários.

## Pilha
| Camada | Tecnologia |
|---|---|
| Site | React 19 + Vite + TypeScript, CSS puro com temas (`data-tema` claro/escuro × `data-estilo`: Di Paula, Bordô, Meia-noite, Ardósia, Grafite, Oceano), fonte Plus Jakarta Sans |
| API | Fastify 5 + TypeScript (Node 24+ roda `.ts` direto) |
| Banco | SQLite nativo (`node:sqlite`), migrações SQL versionadas; imagens, vídeos e anexos em arquivos (`PASTA_MIDIA`); documentos enviados em `DOCUMENTOS_PASTA` (volume `portal_arquivos` no Docker) |
| Testes de tela | Playwright (`e2e/`, `npm run e2e`): API e site isolados (3200/5274, banco novo), Edge local / Chromium no CI. Testes que gravam criam perfil, pessoa e conteúdo pela API (`e2e/ajuda.ts`: `apiComo`, `criarPerfil`, `criarPessoa`). Se der `EADDRINUSE 3200`, sobrou uma API de teste de rodada anterior: encerrar o processo `servidor/src/main.ts` da porta 3200 |
| Avisos | Web Push (`web-push`) e e-mail via serviço Zimbra separado |
| Testes | `node:test` (205 testes: API com banco em memória, contraste WCAG dos temas, regras de links) |
| Repositório | npm workspaces (`web`, `servidor`); sem Next.js nem pnpm |

## Pastas
```
web/src/<modulo>/      telas de cada módulo (inicio, comunicados, documentos, pessoas, ajuda, pesquisas, perfil, aplicacoes, gestao)
web/src/               shell: App.tsx, Menu.tsx, Login.tsx, tema.tsx, estilo.css (tokens), css/parte-NN.css (layout)
modulos/<nome>/api/    rotas da API de cada módulo (registradas em servidor/src/app.ts)
modulos/<nome>/data/   dados fictícios do seed/demonstração
modulos/<nome>/tests/  testes do módulo
servidor/src/          app.ts, config.ts, db.ts, validar.ts, estatico.ts, cli/ (migrar, seed, admin, demo, backup)
infra/migracoes/       NNN-nome.sql (rodam sozinhas ao subir o servidor)
dados-privados/        banco e arquivos locais (fora do Git)
docs/                  esta documentação
```

## Módulos da API (21)
acessos · aplicacoes · aprovacoes · avisos · banners · calendario · comunicados · demonstracao · documentos · imagens · inicio (destaques) · institucional · integracoes (Zimbra) · marca (empresa e tela de entrada) · perfil · pessoas (contatos) · pessoasmes (aniversariantes e novos) · propriedade · pulso (pesquisas) · push · redes. Total: cerca de 160 rotas (ver [referencia-api.md](referencia-api.md)).

## Fluxo de uma requisição
1. O navegador chama `/api/...` (em desenvolvimento o Vite repassa à porta 3100).
2. Um hook global confere a **sessão** (cookie httpOnly) e a **origem** (proteção CSRF). Sem login, só `/api/login`, `/api/esqueci-senha`, `/api/empresa`, `/api/entrada`, `/api/publico/imagens/*` e `/api/saude` respondem.
3. A rota aplica `exigirPerm(...)`/`exigir(...)` (`modulos/acessos/api/guard.ts`), valida a entrada (`servidor/src/validar.ts`), grava e chama `auditar(...)` (sem senhas).
4. Conteúdo de outra pessoa: `modulos/propriedade` decide se pode editar ou apagar (ver abaixo).

## Regras do domínio (não quebrar)
- **Dados fictícios** nesta fase; nada de pessoas, documentos ou credenciais reais no Git.
- **Propriedade do conteúdo:** o dono fica em `criado_por`. Só o administrador apaga o que outra pessoa publicou; editar o que é de outra pessoa exige pedido autorizado pelo dono ou pelo administrador (vale 24 h; chega no sino de ambos). Conteúdo novo com editar/apagar entra na lista `RECURSOS` de `modulos/propriedade/api/index.ts`.
- **Biometria e "manter conectado":** `modulos/biometria` usa passkeys (WebAuthn, `@simplewebauthn`): o aparelho guarda a digital/rosto e o servidor só a chave pública (`passkeys`). Exige HTTPS (ou localhost) e endereço com nome. `manter` na entrada cria sessão de 30 dias (`sessoes.manter`); sem ele, 12 h. Trocar a senha preserva a escolha. Testes: `modulos/biometria/tests` (autenticador de mentira) e `e2e/biometria.spec.ts` (autenticador virtual do Chromium, em `http://localhost`).
- **Público por departamento:** `modulos/publico` (sem rotas) guarda em `publico_departamentos` quem recebe cada comunicado e cada pesquisa (sem linhas = todos). Só departamento, de propósito: escolher pessoas quebraria o anonimato das pesquisas. `noPublico`/`paraUsuario` geram o trecho de SQL usado na lista, no detalhe, no sino, no e-mail, no push e na contagem de pendentes das pesquisas. Quem não tem departamento só vê o que é para todos. O formulário usa `web/src/gestao/CampoPublico.tsx`. Aberturas de comunicado (`comunicado_aberturas`) alimentam "lidos × publicados" no painel de uso.
- **Login pelo Keycloak (SSO)** (`modulos/keycloak`): OpenID Connect, código + PKCE; o servidor troca o código e lê `/userinfo`. Variáveis `KEYCLOAK_ISSUER_URL` (ou `KEYCLOAK_URL`+`KEYCLOAK_REALM`), `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`; retorno em `/api/v1/admin/auth/callback` (e `/api/v1/auth/callback`). Casa pelo e-mail com um usuário ativo; quem é do realm e não tem cadastro é **criado como Consulta, sem senha local** (`KEYCLOAK_PERFIL_PADRAO`, `KEYCLOAK_CRIAR_USUARIOS=0` desliga); o perfil dado à mão nunca é sobrescrito. Falha: `/login?sso=<motivo>`; com `MODO_DEBUG=1` a tela mostra o detalhe. O botão só aparece se `/api/auth/keycloak/ativo` responder `true`.
- **Publicação pela plataforma (srv-007):** `app.yml`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml` (template `app-template`); `develop` → homologação, tag `v*` → produção. Dados no volume `/dados`. `ADMIN_LOGIN/ADMIN_SENHA/ADMIN_EMAIL` criam o primeiro administrador com o banco vazio e `ADMIN_REDEFINIR=1` o redefine (remover depois de entrar); `MODO_DEBUG=1` mostra o detalhe dos erros 500 (ignorado com `APP_ENV=prod`). Detalhes em `docs/implantacao.md`.
- **Segundo fator (biometria):** opcional, ligado pela própria pessoa (`usuarios.segundo_fator`). `POST /api/login` com senha certa devolve só um `ticket` (memória, `modulos/acessos/api/tickets.ts`); a sessão nasce em `POST /api/biometria/segundo-fator` depois da biometria. Desligar exige a senha; remover a última biometria desliga; o administrador desliga por `…/segundo-fator/desligar`.
- **Uso do portal:** `modulos/uso` guarda um evento por entrada e por tela aberta (`uso_eventos`; `POST /api/uso/tela` chamado por `App.tsx`), 12 meses, e alimenta Configurações › Uso do portal (por dia, tela, horário, aparelho, departamento e pessoa). Identifica pessoas: exige `cfg.uso.ver` e cada consulta por pessoa é auditada. O departamento da pessoa fica em `usuarios.departamento_id`.
- **Aprovação:** em Comunicados, Redes sociais, Banners e Documentos, a permissão `pub.<aba>.aprovacao` faz a publicação depender da aprovação do RH (`modulos/aprovacoes`).
- **Abertura de apps externos:** computador = nova aba (`_blank`, `rel="noopener noreferrer"`); celular = mesma aba. Só URLs http(s). Regra em `web/src/links.ts` (testada).
- **Acessibilidade WCAG 2.2 AA:** foco visível, teclado, rótulos, `prefers-reduced-motion`; cores só por variáveis do tema; `web/test/contraste.test.ts` valida.
- **Zoom do tema:** o app aplica `zoom` no `<html>` e expõe `--zoom`. Alturas em `vh` devem ser divididas por `var(--zoom, 1)`; elementos `fixed` precisam medir e corrigir.
- **Escala automática (13/11/2026):** `web/src/escala-auto.ts`. Em janela de computador (≥ 861 px) menor que 1600×860, o portal reduz tudo na mesma proporção (mínimo 60%, ex.: 1345×644 → 75%) em vez de trocar de layout; o fator multiplica a escala escolhida pelo usuário em `--zoom`. As consultas de mídia com `px` em largura/altura são reescritas em tempo de execução para o espaço "projetado" (px reais × fator), senão regras como `max-height: 800px` disparariam no tamanho real. Letras menores que 10 px reais são ampliadas na própria regra CSS (`fonteAjustada`, mínimo `FONTE_MIN_REAL`) para continuarem legíveis. Celular não é reduzido. Teste: `web/test/escala-auto.test.ts`. Ao escrever CSS novo, o `@media` com `px` já vale no espaço projetado: não é preciso tratar o fator.
- **Letra mínima na escala automática:** com o portal reduzido, textos menores que 10 px reais são ampliados na própria regra CSS (`fonteAjustada`, `FONTE_MIN_REAL`). Ficam de fora (`SEM_PISO` em `escala-auto.ts`): `.menu-rodape`, `.menu-label`, `.lema` e `.cal-topo`.
- **Calendário do menu (`Calendario.tsx`):** só a grade do mês; a seta (aba) fica presa à borda do menu, na altura do calendário, e abre o painel dos compromissos do dia à direita, por cima da tela, em vidro (`.cal-voo-casca` fixo via portal em `document.body`; medidas por `offsetTop/offsetLeft` e `--zoom`, remedidas com `ResizeObserver`). Clicar num dia seleciona e abre o painel; "Abrir calendário completo" leva à tela cheia. Não aparece no celular.
- **Calendário tela cheia (`CalendarioPagina.tsx`):** a barra (navegação, legendas, ações) se organiza por *container query* (`.calp-barra`, até 900/520 px). No celular (≤ 600 px) a grade mostra só o número e pontinhos coloridos; tocar no dia rola até os detalhes; legendas começam recolhidas.
- **Barra de aplicativos no celular:** tocar em Aplicativos abre a faixa recolhida (`barraMob` em `App.tsx`, classe `.barra-mob` no `Lancador`); o botão do topo da faixa expande a lista e a seta recolhe; tocar fora ou Esc fecha.
- **Carregamento sob demanda:** `App.tsx` abre Publicar, Configurações, Ajuda e Calendário com `lazy` + `Suspense` (blocos separados no build); o pacote inicial fica menor.
- **Datas sobre avatares** (aniversariantes, tempo de casa, novos, destaque do ano): a etiqueta `.pessoa-periodo` fica na borda de baixo da foto, dentro de `.pessoa-foto`.
- **Painéis flutuantes por cima de janelas pop-up** (`web/src/flutuante.ts`): listas (`CampoLink`) e balões de ajuda (`Dica`) usam `popover="manual"` (camada superior do navegador) e `posicionarFlutuante`, que cola o painel ao campo, abre para o lado com mais espaço, limita a altura e mede a janela com um elemento de teste (funciona com o zoom automático). Assim nada é cortado pelo `overflow` da janela. Não use `position: absolute/fixed` simples para listas dentro de `dialog`.
- **Prévia ao vivo nos cadastros** (`Crud` aceita `previa={(valores) => …}`, `JanelaForm` tem a coluna `.previa-lado`): componentes em `web/src/gestao/PreviaBanner.tsx` e `PreviasCadastro.tsx` (comunicado, documento, pessoa, aplicativo, rede) reaproveitam as classes dos cartões reais. `FormatoIdeal.tsx` mostra o tamanho ideal de imagem/vídeo ao lado das prévias de banner e da tela de entrada. A explicação de cada campo (`dica`) vai no ícone "!" (`RotuloDica` em `Dica.tsx`).
- **Carrosséis do Início** (`inicio/Novidades.tsx`): os três aparecem sempre; sem banner, `SlotVazio` mostra uma arte fixa (a esquerda usa a faixa padrão). `FundoSlide` mede a proporção da mídia: corte de até ~28% = preenche (`cover`); acima disso mostra inteira (`contain`, à direita) sobre a própria mídia desfocada. O botão pode apontar para `#documentos/<slug>`: abre o `VisualizadorArquivo` sem sair do Início.
- **Quadros de pessoas do Início** (`inicio/PessoasDoMes.tsx`): os três (aniversariantes, tempo de casa, novos) aparecem sempre, com mensagem quando vazios. **Missão/Visão/Valores** (`MissaoVisaoValores.tsx`): cartão de vidro nas cores do tema (`.mvv-vidro`) com marca-d'água de alvo.
- **Documentos:** versão e responsável são automáticos no servidor (`1.0`; sobe para `N+1.0` quando `link_oficial`/origem muda; responsável = quem criou). `origem: 'envio'` do formulário vira `pasta`. O envio do computador (`POST /api/gestao/documentos/arquivo`, tipo `application/x-documento`, até 50 MB, conferência de conteúdo, nome único) grava em `<DOCUMENTOS_PASTA>/Enviados/`. A miniatura do cartão (`web/src/previaDocumento.ts`) desenha só a página: PDF por **pdf.js** (`pdfjs-dist`, carregado sob demanda, worker `?url`), Word por mammoth, Excel por **jszip** (`lerPlanilha` em `web/src/arquivos.ts`), CSV/TXT como texto, tudo em quadro `sandbox` sem scripts; até 12 MB e só quando o cartão aparece. Cartões de tamanho fixo (400 × 260), 4 por linha (`.grade-docs`, margem de 10 px).
- **Volumes do Docker:** `portal_dados` (`/dados`: banco e backups) e **`portal_arquivos`** (`/arquivos/midia` e `/arquivos/documentos`). Na primeira subida, `servidor/src/pasta-legada.ts` copia `PASTA_MIDIA_LEGADA`/`DOCUMENTOS_PASTA_LEGADA` (pastas antigas em `/dados`) para o volume novo se o destino estiver vazio, sem apagar o original.
- **Keycloak: pessoas sem cadastro** (`modulos/keycloak/api`, `listarPessoasKeycloak`): lê o realm pela API de administração (`<issuer>/admin/realms/<realm>/users`) com a conta de serviço (`client_credentials`) do cliente do login ou de `KEYCLOAK_ADMIN_CLIENT_ID/SECRET`; cache de 2 min. `GET /api/gestao/usuarios/keycloak` (cfg.usuarios.criar) devolve só quem não tem usuário (cruza por e-mail ou login). `POST /api/usuarios` aceita `sso: true` (exige e-mail; sem senha local utilizável, sem troca obrigatória).
- Marca, cores e logo são **provisórios** (validar com Marketing).

## Segurança já implementada
Senhas com scrypt; sessão em cookie httpOnly e `Secure` em produção, 12 h; bloqueio por tentativas de login; CSRF por conferência de origem; validação de toda entrada; imagens conferidas pelos primeiros bytes (SVG só passa por filtro, com CSP restrita); cabeçalhos de segurança; auditoria só-inclusão; `npm audit` sem vulnerabilidades (12/11/2026); dados pessoais do "Meu perfil" visíveis só à pessoa, com exceção da ficha de emergência (permissão própria, cada consulta auditada).

## Comandos
`npm install` · `npm run dev` · `npm run typecheck` · `npm run build` · `npm test` · `npm run publicar` (os três anteriores) · `npm run banco:migrar` · `npm run banco:seed` · `npm run demo` · `npm run admin:criar -- <login> "<Nome>"` · `npm run backup`.
