# Portal Intranet Di Paula

Portal interno responsivo (desktop + celular) da Di Paula: comunicados, aplicações (links), documentos e reconhecimento de pessoas. **Dados 100% fictícios nesta fase.** Idioma de tudo (UI, docs, commits, respostas): **português do Brasil**.

## Stack (a mesma do PREMIA)
TypeScript · React 19 + Vite (`web/`) · Fastify + SQLite nativo `node:sqlite` (`servidor/`) · CSS puro com temas (`data-tema` claro/escuro × `data-estilo` Bordô, Meia-noite, Ardósia, Grafite, Oceano; fonte Plus Jakarta Sans) · testes com `node:test` · npm workspaces · Node 24+. **Não usar Next.js nem pnpm.**

## Comandos
- `npm install` · `npm run dev` (API 3100 + site http://localhost:5174, o Vite repassa `/api`) · `npm run typecheck` · `npm run build` · `npm test`
- Banco: `npm run banco:migrar` · `npm run banco:seed` (admin/admin123, só dev). Migrações em `infra/migracoes/NNN-nome.sql`; banco em `dados-privados/portal.db` (fora do Git).
- Antes de dizer "pronto": rodar `typecheck`, `build` e `test` e conferir a saída.

## Estrutura (igual ao PREMIA)
- `web/src/<modulo>/` = telas de cada módulo (`inicio`, `comunicados`, `aplicacoes`, `documentos`); `web/src/` raiz = shell (`App.tsx`, `Menu.tsx`), `tema.tsx`, `temas-dados.ts`, `estilo.css`, `icones.tsx`, `api.ts`, `dados.ts`, `links.ts`. `web/test/` = testes (inclui contraste WCAG dos temas).
- `modulos/<nome>/api/` = rotas da API de cada módulo (registradas em `servidor/src/app.ts`); `modulos/<nome>/data/` = dados fictícios usados pelo seed; `modulos/<nome>/tests/`.
- `servidor/` = Fastify, `config.ts`, `db.ts`, CLIs `migrar`/`seed`. `infra/migracoes/` = SQL versionado.
- **Um módulo por vez**: não mexer em outro módulo sem pedir. Ordem/status: `docs/roteiro-modulos.md`.

## Regras do domínio (não quebrar)
- Dados fictícios e rotulados como demonstração. Nada de pessoas, documentos ou credenciais reais. Login ainda não existe (API só de leitura).
- Abertura de apps externos: **desktop = nova aba** (`_blank`, `rel="noopener noreferrer"`); **celular = mesma aba** (Voltar retorna). Regra em `web/src/links.ts` (testada). Só URLs http(s).
- Acessibilidade WCAG 2.2 AA: foco visível, teclado, rótulos, `prefers-reduced-motion`. Cores só por variáveis do tema (nunca hex solto nas telas); `web/test/contraste.test.ts` valida.
- Barra superior fixa e independente do lançador direito; botão de recolher o menu no topo da barra lateral, ao lado da marca.
- Marca, cores e logo são **provisórios** (validar com Marketing).

## Onde está o contexto
Requisitos `docs/requisitos.md` · Estrutura/riscos `docs/avaliacao-estrutura.md` · Decisões `docs/decisoes.md` · **Memória portátil `docs/memoria/MEMORY.md`** (leia o estado antes de agir) · Originais do plano `docs/origem-manus/` (histórico).

## Gatilhos do usuário
Ver `docs/memoria/gatilhos.md`: **retomar**, **enviar** (commit + push sem perguntar), **salvar ponto de parada**, **registre nas melhorias futuras**. O usuário também pediu modo automático: executar sem pedir aprovação.

## Git
Branch `main`, remoto `origin` = https://github.com/Jampierry/Portal-Intranet. Commits em pt-BR `tipo(modulo): descrição`.
