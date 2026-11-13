# Gatilhos do usuário

- **retomar** — só resumir onde paramos (ler `estado-e-ponto-de-parada.md`), sem perguntas.
- **enviar** — fazer o commit pendente e o push para o GitHub, sem perguntar.
- **enviar org** — `powershell -File scripts/enviar-org.ps1 -Enviar`: leva a `main` para `org/main` sempre limpa (sem CLAUDE.md, `.claude/`, `docs/memoria/`, `docs/origem-manus/`, `web/imagens/`, `docs/avaliacao-estrutura.md`, `docs/comparativo-mercado.md`), via branch `org-main`; base do diff = tag local `org-base`. Nunca dar push da `main` no `org`.
- **salvar ponto de parada** — atualizar `estado-e-ponto-de-parada.md` e `modulos-status.md` (o usuário dá `/clear` em seguida).
- **registre nas melhorias futuras** — anotar em `docs/melhorias-futuras.md`, sem implementar.
