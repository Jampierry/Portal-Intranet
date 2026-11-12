# Visão geral e arquitetura

## O que é
Portal interno responsivo (computador e celular) da Di Paula: comunicados, aplicativos (links), documentos, contatos, calendário, pesquisas e reconhecimento de pessoas. Login local obrigatório; o administrador cria os usuários.

## Pilha
| Camada | Tecnologia |
|---|---|
| Site | React 19 + Vite + TypeScript, CSS puro com temas (`data-tema` claro/escuro × `data-estilo`: Di Paula, Bordô, Meia-noite, Ardósia, Grafite, Oceano), fonte Plus Jakarta Sans |
| API | Fastify 5 + TypeScript (Node 24+ roda `.ts` direto) |
| Banco | SQLite nativo (`node:sqlite`), migrações SQL versionadas |
| Avisos | Web Push (`web-push`) e e-mail via serviço Zimbra separado |
| Testes | `node:test` (147 testes: API com banco em memória, contraste WCAG dos temas, regras de links) |
| Repositório | npm workspaces (`web`, `servidor`); sem Next.js nem pnpm |

## Pastas
```
web/src/<modulo>/      telas de cada módulo (inicio, comunicados, documentos, pessoas, ajuda, pesquisas, perfil, aplicacoes, gestao)
web/src/               shell: App.tsx, Menu.tsx, Login.tsx, tema.tsx, estilo.css (tokens), css/parte-NN.css (layout)
modulos/<nome>/api/    rotas da API de cada módulo (registradas em servidor/src/app.ts)
modulos/<nome>/data/   dados fictícios do seed/demonstração
modulos/<nome>/tests/  testes do módulo
servidor/src/          app.ts, config.ts, db.ts, validar.ts, estatico.ts, cli/ (migrar, seed, admin, demo, backup)
infra/migracoes/       NNN-nome.sql (rodam sozinhas ao subir o servidor)
dados-privados/        banco e arquivos locais (fora do Git)
docs/                  esta documentação
```

## Módulos da API (21)
acessos · aplicacoes · aprovacoes · avisos · banners · calendario · comunicados · demonstracao · documentos · imagens · inicio (destaques) · institucional · integracoes (Zimbra) · marca (empresa e tela de entrada) · perfil · pessoas (contatos) · pessoasmes (aniversariantes e novos) · propriedade · pulso (pesquisas) · push · redes. Total: cerca de 160 rotas (ver [referencia-api.md](referencia-api.md)).

## Fluxo de uma requisição
1. O navegador chama `/api/...` (em desenvolvimento o Vite repassa à porta 3100).
2. Um hook global confere a **sessão** (cookie httpOnly) e a **origem** (proteção CSRF). Sem login, só `/api/login`, `/api/esqueci-senha`, `/api/empresa`, `/api/entrada`, `/api/publico/imagens/*` e `/api/saude` respondem.
3. A rota aplica `exigirPerm(...)`/`exigir(...)` (`modulos/acessos/api/guard.ts`), valida a entrada (`servidor/src/validar.ts`), grava e chama `auditar(...)` (sem senhas).
4. Conteúdo de outra pessoa: `modulos/propriedade` decide se pode editar ou apagar (ver abaixo).

## Regras do domínio (não quebrar)
- **Dados fictícios** nesta fase; nada de pessoas, documentos ou credenciais reais no Git.
- **Propriedade do conteúdo:** o dono fica em `criado_por`. Só o administrador apaga o que outra pessoa publicou; editar o que é de outra pessoa exige pedido autorizado pelo dono ou pelo administrador (vale 24 h; chega no sino de ambos). Conteúdo novo com editar/apagar entra na lista `RECURSOS` de `modulos/propriedade/api/index.ts`.
- **Aprovação:** em Comunicados, Redes sociais, Banners e Documentos, a permissão `pub.<aba>.aprovacao` faz a publicação depender da aprovação do RH (`modulos/aprovacoes`).
- **Abertura de apps externos:** computador = nova aba (`_blank`, `rel="noopener noreferrer"`); celular = mesma aba. Só URLs http(s). Regra em `web/src/links.ts` (testada).
- **Acessibilidade WCAG 2.2 AA:** foco visível, teclado, rótulos, `prefers-reduced-motion`; cores só por variáveis do tema; `web/test/contraste.test.ts` valida.
- **Zoom do tema:** o app aplica `zoom` no `<html>` e expõe `--zoom`. Alturas em `vh` devem ser divididas por `var(--zoom, 1)`; elementos `fixed` precisam medir e corrigir.
- Marca, cores e logo são **provisórios** (validar com Marketing).

## Segurança já implementada
Senhas com scrypt; sessão em cookie httpOnly e `Secure` em produção, 12 h; bloqueio por tentativas de login; CSRF por conferência de origem; validação de toda entrada; imagens conferidas pelos primeiros bytes (SVG só passa por filtro, com CSP restrita); cabeçalhos de segurança; auditoria só-inclusão; `npm audit` sem vulnerabilidades (12/11/2026); dados pessoais do "Meu perfil" visíveis só à pessoa, com exceção da ficha de emergência (permissão própria, cada consulta auditada).

## Comandos
`npm install` · `npm run dev` · `npm run typecheck` · `npm run build` · `npm test` · `npm run publicar` (os três anteriores) · `npm run banco:migrar` · `npm run banco:seed` · `npm run demo` · `npm run admin:criar -- <login> "<Nome>"` · `npm run backup`.
