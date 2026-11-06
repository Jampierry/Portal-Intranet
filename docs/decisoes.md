# Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-11-06 | Raiz do projeto = `Documents/GitHub/Portal-Intranet`; pasta `Plano de implantação` vira só origem (fora do Git) | VS Code e Git na pasta certa |
| 2026-11-06 | Código por módulos: front em `web/src/<modulo>/`, API em `modulos/<nome>/api`; um módulo por vez | Pedido do usuário; mesma estrutura do PREMIA |
| 2026-11-06 | npm (não pnpm), Node 24+ | PREMIA usa npm; menos setup em outra máquina |
| 2026-11-06 | Memória do Claude portátil em `docs/memoria/` + `CLAUDE.md` | A memória local do Claude não sincroniza entre máquinas |
| 2026-11-06 | Servidor Fastify + SQLite (`node:sqlite`) com migrações SQL, igual ao PREMIA | Pedido do usuário |
| 2026-11-06 | Front migrado de Next.js (export estático) para React + Vite, com temas claro/escuro × 5 estilos do PREMIA; API na 3100, site na 5174 | Pedido do usuário: mesma stack, temas, linguagem e estrutura do PREMIA. Substitui as decisões anteriores de Next.js e exportação estática |
| 2026-11-06 | Modo automático: executar e enviar ao GitHub sem pedir aprovação | Pedido do usuário |
| 2026-11-06 | Push ao GitHub com o gatilho "enviar" (ou quando o usuário mandar enviar tudo) | Ação externa autorizada pelo usuário |
