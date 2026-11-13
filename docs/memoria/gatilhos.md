# Gatilhos do usuário

- **retomar** — só resumir onde paramos (ler `estado-e-ponto-de-parada.md`), sem perguntas.
- **enviar** — fazer o commit pendente e o push para o GitHub, sem perguntar.
- **enviar org** — `powershell -File scripts/enviar-org.ps1 -Enviar`: leva a `main` para `org/main` sempre limpa (sem CLAUDE.md, `.claude/`, `docs/memoria/`, `docs/origem-manus/`, `web/imagens/`, `docs/avaliacao-estrutura.md`, `docs/comparativo-mercado.md`), via branch `org-main`; base do diff = tag local `org-base`. Nunca dar push da `main` no `org`.
- **salvar** / **salvar ponto de parada** — o usuário programa de **duas máquinas**, então salvar = (1) atualizar `estado-e-ponto-de-parada.md` e `modulos-status.md`, (2) **atualizar também docs e manuais afetados pelas mudanças** (`docs/arquitetura.md`, `referencia-api.md`, `banco-de-dados.md`, `permissoes-e-perfis.md`, `docs/manuais/*`, `mapa-do-sistema.md`, `README.md` de CSS etc., só onde houve mudança), (3) rodar lint/typecheck/test, (4) commit e push para `origin` (sem pedir), para a outra máquina/perfil conseguir continuar. O usuário costuma dar `/clear` em seguida.
- **registre nas melhorias futuras** — anotar em `docs/melhorias-futuras.md`, sem implementar.
