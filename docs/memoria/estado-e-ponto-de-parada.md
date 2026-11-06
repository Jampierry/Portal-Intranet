# Estado e ponto de parada

**Atualizado em:** 2026-11-06 (fim da sessão)

- Projeto na stack do PREMIA: `web/` (Vite + React + temas), `servidor/` (Fastify + SQLite), `infra/migracoes` (001 base, 002 portal), seed fictício. Tudo enviado ao GitHub (`main`, commit `aa0f845` + este).
- Telas (http://localhost:5174, API em 3100): Início (comunicados recentes + carrossel), Comunicados, Aplicações, Documentos, lançador de apps à direita, painel de tema/estilo/escala.
- `npm run typecheck`, `npm run build` e `npm test` passam (contraste dos temas + regra de links).
- **Não verificado visualmente**: as telas nos 5 estilos × claro/escuro e na largura de celular.
- Pasta original `Plano de implantação/` fica só no disco (fora do Git).
- Usuário pediu modo automático (sem aprovações) e envio ao GitHub ao terminar.

## Como retomar
1. `git pull`, `npm install`, `npm run banco:migrar`, `npm run banco:seed`, `npm run dev`.
2. Conferir as telas e os estilos no navegador.

## Próximos passos
- Módulo acessos: login, perfis e permissões (igual ao PREMIA).
- Comunicados: detalhe e gestão (rascunho/publicado/arquivado). Documentos: versão e responsável.
- Ver `docs/roteiro-modulos.md`.
