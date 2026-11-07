# Estado e ponto de parada

**Atualizado em:** 2026-11-06 (redesign visual)

- Projeto na stack do PREMIA: `web/` (Vite + React + temas), `servidor/` (Fastify + SQLite), `infra/migracoes` (001 base, 002 portal), seed fictício. Tudo enviado ao GitHub (`main`, commit `aa0f845` + este).
- Telas (http://localhost:5174, API em 3100): Início (comunicados recentes + carrossel), Comunicados, Aplicações, Documentos, lançador de apps à direita, painel de tema/estilo/escala.
- `npm run typecheck`, `npm run build` e `npm test` passam (contraste dos temas + regra de links).
- **Não verificado visualmente**: as telas nos 5 estilos × claro/escuro e na largura de celular.
- Pasta original `Plano de implantação/` fica só no disco (fora do Git).
- Usuário pediu modo automático (sem aprovações) e envio ao GitHub ao terminar.

## Redesign visual (2026-11-06)
- Layout das imagens de `docs/origem-manus/design/` aplicado sobre os temas existentes (nenhuma cor nova): menu escuro com marca e "Aplicações web", topo claro com busca/tema/sino/avatar, Início (saudação, faixa "Novidades da semana", pessoas em destaque, comunicados, aplicações favoritas), Comunicados (destaque + grade + painel "Temas"), Aplicações e Documentos em cartões, abas fixas no celular.
- Trazido do PREMIA: avatares (galeria de 16 + iniciais) e janela "Meu perfil", cartão de usuário no menu, submenus flutuantes com hover no menu recolhido, sino com avisos (comunicados urgentes), pular para o conteúdo.
- O lançador de apps da direita foi removido (as favoritas aparecem no menu e no Início).
- Tela inicial vem do endereço (`#comunicados`, `#aplicacoes`, `#documentos`); Voltar do navegador funciona.
- CSS novo em `web/src/portal.css`; tokens de tema continuam em `estilo.css` (o teste de contraste lê só ele).
- Estilo novo **Di Paula** (`data-estilo=dipaula`, agora o padrão): menu carvão, fundo creme, ameixa de destaque, coral nos botões de chamada (coral um pouco mais escuro que o da imagem para passar no contraste). Tokens em `estilo.css`; passa no teste de contraste (claro e escuro). Conferido por screenshot no claro e no escuro.
- **Sem fotos**: capas são blocos de cor do tema (`web/src/Capa.tsx`, aceita `foto` quando houver URL).
- Verificado por screenshot (escuro): Início, Comunicados, celular. **Falta conferir**: modo claro e os outros 4 estilos, Aplicações/Documentos, menu recolhido.

## Como retomar
1. `git pull`, `npm install`, `npm run banco:migrar`, `npm run banco:seed`, `npm run dev`.
2. Conferir as telas e os estilos no navegador.

## Próximos passos
- Módulo acessos: login, perfis e permissões (igual ao PREMIA).
- Comunicados: detalhe e gestão (rascunho/publicado/arquivado). Documentos: versão e responsável.
- Ver `docs/roteiro-modulos.md`.
