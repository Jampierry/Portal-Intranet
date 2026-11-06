# Portal Intranet Di Paula

Protótipo do portal interno da Di Paula (Next.js + TypeScript, exportação estática, dados fictícios).

## Rodar em qualquer máquina
1. Instale Node 22 ou superior e Git.
2. `git clone https://github.com/Jampierry/Portal-Intranet.git`
3. No VS Code: **Arquivo > Abrir Pasta...** e escolha a pasta **Portal-Intranet** (a raiz do repositório).
4. No terminal: `npm install` e depois `npm run dev` → http://localhost:3000

Antes de começar a trabalhar: `git pull`. Ao terminar: commit + `git push` (ou diga **enviar** ao Claude).

## Comandos
`npm run dev` · `npm run typecheck` · `npm run build` (gera `out/`)

## Documentação
Comece por [CLAUDE.md](CLAUDE.md) e [docs/memoria/MEMORY.md](docs/memoria/MEMORY.md). Requisitos em [docs/requisitos.md](docs/requisitos.md); ordem de trabalho em [docs/roteiro-modulos.md](docs/roteiro-modulos.md).

## Estrutura
`app/` rotas finas · `modulos/` um módulo por pasta (shell, inicio, aplicacoes, comunicados, documentos) · `compartilhado/` · `public/` · `docs/`
