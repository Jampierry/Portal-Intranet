# Estado e ponto de parada

**Atualizado em:** 2026-11-06

- Projeto reorganizado a partir do export em `Plano de implantação/` para `app/` + `modulos/` + `compartilhado/` + `docs/`.
- `npm run typecheck` e `npm run build` passam (rotas `/`, `/aplicacoes`, `/comunicados`, `/documentos`).
- Git local inicializado com remoto `Jampierry/Portal-Intranet`; **push ainda não feito** (aguardando o gatilho "enviar").
- A página **Início** foi recriada (o export não a trazia) — conferir visualmente com `docs/origem-manus/design/`.
- Pasta original `Plano de implantação/` mantida intacta; apagar só com autorização do usuário.

- Servidor + banco criados (Fastify, SQLite, `infra/migracoes` 001-base e 002-portal; seed fictício). Tabelas: usuarios, sessoes, auditoria, departamentos, contatos, aplicacoes, favoritos, comunicados, documentos, periodos_destaque, destaques. API de leitura em `modulos/*/api`. O site ainda não consome a API.

## Próximo passo
1. Usuário abre a pasta `Portal-Intranet` no VS Code e confere (`npm run dev`).
2. Dizer **enviar** para o primeiro push.
3. Começar o módulo `shell` (Entregas 10 e 11) — ver `docs/roteiro-modulos.md`.
