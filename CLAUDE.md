# Portal Intranet Di Paula

Portal interno responsivo (desktop + celular) da Di Paula: comunicados, aplicações (links), documentos e reconhecimento de pessoas. **Protótipo estático com dados 100% fictícios.** Idioma de tudo (código de UI, docs, commits, respostas): **português do Brasil**.

## Comandos (npm — não usar pnpm)
- `npm install` · `npm run dev` (http://localhost:3000) · `npm run typecheck` · `npm run build` (gera `out/`)
- Antes de dizer "pronto": rodar `typecheck` e `build` e conferir a saída.

## Estrutura e regra de trabalho
- `app/` = só rotas finas (importam de `modulos/`). `modulos/<nome>/` = código de cada módulo (componentes, dados, tests, README). `compartilhado/` = ícones/utilitários comuns.
- Módulos: `shell`, `inicio`, `aplicacoes`, `comunicados`, `documentos`. **Um módulo por vez**: não mexer em outro módulo sem pedir. Ordem e status: `docs/roteiro-modulos.md`.
- Alias `@/*` → raiz (ex.: `@/modulos/shell/portal-shell`). Um módulo só importa de outro pela superfície pública (componentes exportados), nunca de dentro de `data/` alheio sem necessidade.

## Regras do domínio (não quebrar)
- Dados fictícios e rotulados como demonstração. Nada de pessoas, documentos ou credenciais reais. Sem login/backend nesta fase.
- Abertura de apps externos: **desktop = nova aba** (`_blank`, `rel="noopener noreferrer"`); **celular = mesma aba**, retorno pelo Voltar do navegador. Não prometer fechar aba/liberar memória.
- Acessibilidade WCAG 2.2 AA: foco visível, teclado, rótulos, `prefers-reduced-motion`.
- Marca, cores e logo são **provisórios** (validar com Marketing).
- Exportação estática (`output: "export"`, `trailingSlash`): sem `searchParams` no servidor, sem rotas dinâmicas de servidor.

## Onde está o contexto
- Requisitos: `docs/requisitos.md` · Estrutura/riscos: `docs/avaliacao-estrutura.md` · Decisões: `docs/decisoes.md`
- **Memória portátil (vale em qualquer máquina)**: `docs/memoria/MEMORY.md` — leia o estado antes de agir.
- Originais do plano: `docs/origem-manus/` (somente leitura/histórico).

## Gatilhos do usuário
Ver `docs/memoria/gatilhos.md`: **retomar** (só resumir onde paramos), **enviar** (commit pendente + push, sem perguntar), **salvar ponto de parada** (atualizar `docs/memoria/estado-e-ponto-de-parada.md`), **registre nas melhorias futuras** (anotar em `docs/melhorias-futuras.md`, sem implementar).

## Git
Branch `main`, remoto `origin` = https://github.com/Jampierry/Portal-Intranet. Commits em pt-BR no formato `tipo(modulo): descrição`. Push só com o gatilho **enviar**.
