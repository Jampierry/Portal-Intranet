# Visão geral e arquitetura

## O que é
Portal interno responsivo (computador e celular) da Di Paula: comunicados, aplicativos (links), documentos, contatos, calendário, pesquisas e reconhecimento de pessoas. Login local obrigatório; o administrador cria os usuários.

## Pilha
| Camada | Tecnologia |
|---|---|
| Site | React 19 + Vite + TypeScript, CSS puro com temas (`data-tema` claro/escuro × `data-estilo`: Di Paula, Bordô, Meia-noite, Ardósia, Grafite, Oceano), fonte Plus Jakarta Sans |
| API | Fastify 5 + TypeScript (Node 24+ roda `.ts` direto) |
| Banco | SQLite nativo (`node:sqlite`), migrações SQL versionadas; imagens, vídeos e anexos em arquivos (`PASTA_MIDIA`) |
| Testes de tela | Playwright (`e2e/`, `npm run e2e`): API e site isolados (3200/5274, banco novo), Edge local / Chromium no CI |
| Avisos | Web Push (`web-push`) e e-mail via serviço Zimbra separado |
| Testes | `node:test` (147 testes: API com banco em memória, contraste WCAG dos temas, regras de links) |
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
- Marca, cores e logo são **provisórios** (validar com Marketing).

## Segurança já implementada
Senhas com scrypt; sessão em cookie httpOnly e `Secure` em produção, 12 h; bloqueio por tentativas de login; CSRF por conferência de origem; validação de toda entrada; imagens conferidas pelos primeiros bytes (SVG só passa por filtro, com CSP restrita); cabeçalhos de segurança; auditoria só-inclusão; `npm audit` sem vulnerabilidades (12/11/2026); dados pessoais do "Meu perfil" visíveis só à pessoa, com exceção da ficha de emergência (permissão própria, cada consulta auditada).

## Comandos
`npm install` · `npm run dev` · `npm run typecheck` · `npm run build` · `npm test` · `npm run publicar` (os três anteriores) · `npm run banco:migrar` · `npm run banco:seed` · `npm run demo` · `npm run admin:criar -- <login> "<Nome>"` · `npm run backup`.
