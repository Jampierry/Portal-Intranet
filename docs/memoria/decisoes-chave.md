# Decisões-chave

- Código em `modulos/<nome>/`; `app/` só rotas finas; **um módulo por vez**.
- npm (não pnpm). Node 22+.
- Protótipo estático (`output: "export"`) com dados 100% fictícios; auth/hospedagem é decisão futura.
- Desktop abre apps em nova aba; celular na mesma aba (Voltar retorna). Sem prometer fechar aba/liberar memória.
- Marca, cores e logo provisórios; validar com Marketing.
- WCAG 2.2 AA e `prefers-reduced-motion`.
- Memória portátil vive no repositório (`docs/memoria/`), porque a memória local do Claude não sincroniza entre máquinas.

Histórico completo: `../decisoes.md`.
