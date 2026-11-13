# Portal Intranet Di Paula

Portal interno responsivo (desktop + celular) da Di Paula: comunicados, aplicações (links), documentos e reconhecimento de pessoas. **Dados 100% fictícios nesta fase.** Idioma de tudo (UI, docs, commits, respostas): **português do Brasil**.

## Stack
TypeScript · React 19 + Vite (`web/`) · Fastify + SQLite nativo `node:sqlite` (`servidor/`) · CSS puro com temas (`data-tema` claro/escuro × `data-estilo` Di Paula (padrão), Bordô, Meia-noite, Ardósia, Grafite, Oceano; fonte Plus Jakarta Sans) · testes com `node:test` · npm workspaces · Node 24+. **Não usar Next.js nem pnpm.**

## Comandos
- `npm install` · `npm run dev` (API 3100 + site http://localhost:5174, o Vite repassa `/api`) · `npm run typecheck` · `npm run build` · `npm test`
- Testes de tela (Playwright, Edge local / Chromium no CI): `npm run e2e` (sobe API 3200 + site 5274 isolados, banco novo). Prints dos manuais com setas: `npm run manuais:prints` (portal em dev no ar; sem dados pessoais nos prints). Logo oficial no banco do ambiente: `npm run marca:logo`.
- Imagens, vídeos e anexos das redes ficam em **arquivos** (`PASTA_MIDIA`, padrão `dados-privados/midia`), não no SQLite; `npm run backup` copia essa pasta.
- Banco: `npm run banco:migrar` · `npm run banco:seed` (admin/admin123, só dev). Migrações em `infra/migracoes/NNN-nome.sql`; banco em `dados-privados/portal.db` (fora do Git).
- Antes de dizer "pronto": rodar `lint`, `typecheck` (web + servidor), `build` e `test` e conferir a saída (`npm run publicar` faz tudo; o CI no GitHub repete).
- Primeiro administrador: `npm run admin:criar -- <login> "<Nome>"`. Produção: definir `ORIGENS_PERMITIDAS` (endereço público do portal) e `NODE_ENV=production`.

## Estrutura
- `web/src/<modulo>/` = telas de cada módulo (`inicio`, `comunicados`, `aplicacoes` — catálogo dentro de Publicar e barra da direita —, `documentos`, `gestao`, `pessoas`, `ajuda`); `web/src/` raiz = shell (`App.tsx`, `Menu.tsx`), `tema.tsx`, `temas-dados.ts`, `estilo.css` (tokens dos temas), `css/parte-01…09.css` (layout e modo compacto; ex-`portal.css`, importados em ordem por `main.tsx`, ver `web/src/css/LEIA-ME.md`), `perfil.tsx` (avatar e perfil local), `Capa.tsx`, `Cabecalho.tsx`, `icones.tsx`, `api.ts`, `dados.ts`, `links.ts`. `web/test/` = testes (inclui contraste WCAG dos temas).
- `modulos/<nome>/api/` = rotas da API de cada módulo (registradas em `servidor/src/app.ts`); `modulos/<nome>/data/` = dados fictícios usados pelo seed; `modulos/<nome>/tests/`.
- `servidor/` = Fastify, `config.ts`, `db.ts`, CLIs `migrar`/`seed`. `infra/migracoes/` = SQL versionado.
- **Um módulo por vez**: não mexer em outro módulo sem pedir. Ordem/status: `docs/roteiro-modulos.md`.

## Regras do domínio (não quebrar)
- Dados fictícios nesta fase (seed). Nada de pessoas, documentos ou credenciais reais no Git. **Login local obrigatório**: o admin master cria os usuários; perfis `admin`, `editor`, `consulta` (ver `modulos/acessos/README.md`). Toda rota nova em `/api` já nasce protegida; para restringir por perfil use `exigir(...)` de `modulos/acessos/api/guard.ts`. Toda alteração de dados deve chamar `auditar(...)` (sem senhas) e validar a entrada com `servidor/src/validar.ts`.
- **Propriedade do conteúdo** (`modulos/propriedade/api/index.ts`): só o administrador apaga o que outra pessoa publicou; editar o que é de outra pessoa exige pedido autorizado pelo dono ou pelo administrador (vale 24 h; chega no sino de ambos). O dono fica em `criado_por`. **Conteúdo novo com editar/apagar: acrescente o recurso na lista `RECURSOS` do módulo** (e a coluna `criado_por` numa migração).
- Abertura de apps externos: **desktop = nova aba** (`_blank`, `rel="noopener noreferrer"`); **celular = mesma aba** (Voltar retorna). Regra em `web/src/links.ts` (testada). Só URLs http(s).
- Acessibilidade WCAG 2.2 AA: foco visível, teclado, rótulos, `prefers-reduced-motion`. Cores só por variáveis do tema (nunca hex solto nas telas); `web/test/contraste.test.ts` valida.
- Barra superior fixa e independente do lançador direito; botão de recolher o menu no topo da barra lateral, ao lado da marca.
- **Logo oficial** da Di Paula (validada pelo Marketing em 13/11/2026): `web/public/marca/logo-dipaula-claro.svg` (escura, para o tema claro) e `logo-dipaula-escuro.svg` (branca, para o tema escuro); `npm run marca:logo` instala as duas como logo da empresa no banco do ambiente (rodar em cada ambiente). Cores e restante da marca seguem **provisórios** (validar com Marketing).

## Onde está o contexto
Requisitos `docs/requisitos.md` · Estrutura/riscos `docs/avaliacao-estrutura.md` · Decisões `docs/decisoes.md` · **Memória portátil `docs/memoria/MEMORY.md`** (leia o estado antes de agir) · Originais do plano `docs/origem-manus/` (histórico).

## Gatilhos do usuário
Ver `docs/memoria/gatilhos.md`: **retomar**, **enviar** (commit + push sem perguntar), **enviar org** (limpo, para a organização), **salvar ponto de parada**, **registre nas melhorias futuras**. O usuário também pediu modo automático: executar sem pedir aprovação.

## Git
Branch `main`, remoto `origin` = https://github.com/Jampierry/Portal-Intranet (pessoal, recebe tudo). Remoto `org` = https://github.com/Di-Paula-Moda-Esportiva/Portal-Intranet (organização, conta GitHub `jampierry-silva`): recebe só a branch local `org-main`, **sem** CLAUDE.md, `.claude/` e `docs/memoria/`; enviar sempre com `powershell -File scripts/enviar-org.ps1 -Enviar` (nunca `git push org main`; exclusões e base `org-base` no script). Identidade local dos commits: `jampierry-silva`. Commits em pt-BR `tipo(modulo): descrição`.
