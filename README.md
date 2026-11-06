# Portal Intranet Di Paula

Portal interno da Di Paula, com a mesma stack do PREMIA: React + Vite (`web/`), API Fastify + SQLite (`servidor/`), TypeScript, temas claro/escuro com 5 estilos. Dados fictícios.

## Rodar em qualquer máquina
1. Instale **Node 24 ou superior** e Git.
2. `git clone https://github.com/Jampierry/Portal-Intranet.git`
3. No VS Code: **Arquivo > Abrir Pasta...** e escolha **Portal-Intranet** (a raiz do repositório).
4. No terminal: `npm install`, depois `npm run banco:migrar` e `npm run banco:seed` (cria o banco local com dados fictícios) e por fim `npm run dev`.
5. Abra http://localhost:5174 (a API fica em http://localhost:3100).

Antes de trabalhar: `git pull`. Ao terminar: commit + `git push` (ou diga **enviar** ao Claude).

## Comandos
`npm run dev` · `npm run typecheck` · `npm run build` · `npm test` · `npm run banco:migrar` · `npm run banco:seed`

O banco (`dados-privados/portal.db`) não vai para o Git. O seed cria o usuário de exemplo `admin` / `admin123` (só desenvolvimento).

## Documentação
Comece por [CLAUDE.md](CLAUDE.md) e [docs/memoria/MEMORY.md](docs/memoria/MEMORY.md). Requisitos em [docs/requisitos.md](docs/requisitos.md); ordem de trabalho em [docs/roteiro-modulos.md](docs/roteiro-modulos.md).

## Estrutura
`web/` front (uma pasta por módulo em `web/src/`) · `servidor/` API · `modulos/<nome>/api|data|tests` · `infra/migracoes` SQL · `docs/`
