# Estado e ponto de parada

**Atualizado em:** 2026-11-06

- Projeto migrado para a stack do PREMIA: `web/` (Vite + React + temas), `servidor/` (Fastify + SQLite), `infra/migracoes` (001 base, 002 portal), seed fictício.
- Telas (http://localhost:5174): Início (comunicados recentes + carrossel de destaques), Comunicados, Aplicações, Documentos, lançador de apps à direita, painel de tema/estilo/escala.
- `typecheck`, `build` e testes (contraste dos temas + regra de links) passam.
- Pasta original `Plano de implantação/` fica só no disco (fora do Git).

## Próximo passo
1. Conferir visualmente cada tela e os 5 estilos (claro/escuro).
2. Próximos módulos: login/permissões (acessos), gestão de comunicados, versão/responsável em documentos. Ver `docs/roteiro-modulos.md`.
