# Decisões-chave

- Stack: React 19 + Vite (`web/`), Fastify + SQLite (`servidor/`), TypeScript, temas claro/escuro × 5 estilos, `node:test`. Sem Next.js, sem pnpm. Node 24+.
- Front em `web/src/<modulo>/`; API em `modulos/<nome>/api`; um módulo por vez.
- Dados 100% fictícios; sem login ainda (API só de leitura).
- Desktop abre apps em nova aba; celular na mesma aba (`web/src/links.ts`).
- Marca, cores e logo provisórios; validar com Marketing.
- Memória portátil vive no repositório (`docs/memoria/`); a memória local do Claude não sincroniza entre máquinas.
- Usuário pediu modo automático: executar sem pedir aprovação.

Histórico completo: `../decisoes.md`.
