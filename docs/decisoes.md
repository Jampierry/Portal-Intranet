# Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-11-06 | Raiz do projeto = `Documents/GitHub/Portal-Intranet`; pasta `Plano de implantação` vira só origem | VS Code e Git na pasta certa |
| 2026-11-06 | Código por módulos em `modulos/<nome>/`; `app/` só com rotas finas | Pedido do usuário; igual ao PREMIA; um módulo por vez |
| 2026-11-06 | npm em vez de pnpm | Máquina sem corepack/pnpm; PREMIA já usa npm; menos setup em outra máquina |
| 2026-11-06 | Memória do Claude portátil em `docs/memoria/` + `CLAUDE.md` | A memória local do Claude não sincroniza entre máquinas |
| 2026-11-06 | Manter exportação estática no protótipo | Dados fictícios; hospedagem/auth ficam para decisão futura |
| 2026-11-06 | Servidor Fastify + SQLite (`node:sqlite`) com migrações SQL, igual ao PREMIA; API na porta 3100, site na 3000 | Pedido do usuário; mesmo padrão do PREMIA. O site ainda é estático e não consome a API (integração é trabalho de cada módulo) |
| 2026-11-06 | Push ao GitHub só com o gatilho "enviar" | Ação externa; confirmação explícita |
