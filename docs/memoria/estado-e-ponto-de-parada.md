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
- Barra lateral direita de aplicativos recriada (`web/src/aplicacoes/Lancador.tsx`): recolhida = ícones dos favoritos com dica; aberta = abas Favoritos / Todos os apps com estrela; no celular vira gaveta pelo botão de apps do topo. As favoritas também aparecem no menu e no Início.
- Tela inicial vem do endereço (`#comunicados`, `#aplicacoes`, `#documentos`); Voltar do navegador funciona.
- CSS novo em `web/src/portal.css`; tokens de tema continuam em `estilo.css` (o teste de contraste lê só ele).
- Estilo novo **Di Paula** (`data-estilo=dipaula`, agora o padrão): menu carvão, fundo creme, ameixa de destaque, coral nos botões de chamada (coral um pouco mais escuro que o da imagem para passar no contraste). Tokens em `estilo.css`; passa no teste de contraste (claro e escuro). Conferido por screenshot no claro e no escuro.
- Modo compacto (bloco "Modo compacto" no fim de `portal.css`): fonte base 13px, menu 216px com rótulo "ESPAÇO DE TRABALHO", busca de 36px com selo ENTER, cartões/botões/abas/barra de aplicativos menores, comunicados do Início em linha (capa + texto). Referência: protótipo compacto anterior + telas de `docs/origem-manus/design`.
- Barra superior universal: levemente escurecida (tom do destaque; adaptada ao escuro), "Bem-vindo(a), nome" à esquerda, aviso da tela no meio (mapa `AVISOS` em `App.tsx`; os avisos saíram do corpo das telas), versão, busca à direita e ícones pequenos. Perfil saiu do menu lateral: fica só no avatar do topo.
- **Sem fotos**: capas são blocos de cor do tema (`web/src/Capa.tsx`, aceita `foto` quando houver URL).
- Verificado por screenshot (escuro): Início, Comunicados, celular. Conferido por screenshot: 6 estilos × claro/escuro (Início), menu recolhido (corrigido: só ícones), celular (Aplicações), Documentos, detalhe de comunicado.

## Módulos 4 e 5 (2026-11-06)
- Comunicados: detalhe pronto. API `GET /api/comunicados/:slug` (404 para rascunho/arquivado), tela com corpo em parágrafos e "Mais em <categoria>", endereço `#comunicados/<slug>` (os cartões são links; Voltar do navegador funciona).
- Documentos: versão, responsável e data de revisão (dados de exemplo no seed, só onde estavam vazios).
- Testes novos da API em `modulos/comunicados/tests/api.test.ts` (banco em memória); `npm test` agora roda também `modulos/*/tests`.
- Seed: roda de novo sem duplicar; preenche `corpo` e metadados só onde são nulos.

## Como retomar
1. `git pull`, `npm install`, `npm run banco:migrar`, `npm run banco:seed`, `npm run dev`.
2. Conferir as telas e os estilos no navegador.

## Próximos passos
- Módulo acessos: login, perfis e permissões (igual ao PREMIA); o nome do topo ("Bem-vindo(a)") passa a vir do usuário logado.
- Comunicados: gestão (rascunho/publicado/arquivado) depois do login. Documentos: anexos/download.
- Ver `docs/roteiro-modulos.md`.
