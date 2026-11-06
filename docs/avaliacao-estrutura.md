# Avaliação de estrutura do projeto (06/11/2026)

## Situação encontrada
Export de protótipo (Manus) com ~45 arquivos soltos em `Plano de implantação/`, sem `.git` próprio.

## Achados e o que foi feito
| # | Achado | Ação |
|---|---|---|
| 1 | O repositório git ativo era `Documents/GitHub` (remote `Jampierry/GitHub.git`, sem commits) | Criado `.git` próprio em `Portal-Intranet`, ligado a `Jampierry/Portal-Intranet` |
| 2 | Estrutura plana; só existia 1 `page.tsx` (Aplicações). Faltavam as rotas Início, Comunicados e Documentos | Reorganizado em `app/` + `modulos/`; **recriadas** as 3 rotas (Início é reconstrução — conferir contra `docs/origem-manus/design/*.png`) |
| 3 | Resíduos da plataforma Manus (SKILL.md, build-contracts, routing, dependency-setup, log de terminal, manus-routes.json) | Movidos para `docs/origem-manus/referencias-plataforma/` (não fazem parte do app) |
| 4 | `app.config.ts` apontava a logo em `files.manuscdn.com` e não era usado | Removido do app; usa-se `public/portal-mark.svg` |
| 5 | Sem `pnpm-lock.yaml`; pnpm/corepack ausentes na máquina; PREMIA usa npm | Padronizado em **npm** (`package-lock.json`) |
| 6 | `tsconfig` compilava a pasta de origem | `exclude` de `Plano de implantação`, `docs`, `out` |
| 7 | `globals.css` monolítico (791 linhas) | Mantido; dividir por módulo ao trabalhar cada um |
| 8 | Docs divergentes (estrutura plana vs `src/features`) | Fonte única: `modulos/` (ver `decisoes.md`) |

## Riscos abertos
- **Hospedagem estática x requisitos de segurança**: `output: "export"` não suporta login, permissões nem auditoria. Decidir servidor/hospedagem antes de qualquer dado real.
- **Sem testes nem lint**: só `typecheck`. Adicionar testes por módulo (Vitest/Playwright) e ESLint conforme cada módulo for trabalhado.
- **Versões fixadas** (`next 16.4.5`, `react 19.3.1`): instalaram e compilaram; revisar periodicamente.
- **Marca provisória**: validar logo, cores e fontes com Marketing.
- **Entregas 10 e 11 incompletas**: o menu hambúrguer já existe no código, mas a barra superior ainda é `sticky` e o hambúrguer está no cabeçalho; ver módulo `shell`.
