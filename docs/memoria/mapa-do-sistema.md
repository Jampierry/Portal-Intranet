# Mapa do sistema — Portal Intranet Di Paula (07/11/2026)

Leia este arquivo antes de procurar código. Ele resume **o que existe, onde está, quem pode usar e o que ainda falta**.

## 1. Visão geral
- Portal interno em português do Brasil: Início, Comunicados, Documentos, Pessoas, Ajuda, Publicar (conteúdo) e Configurações (acessos e integrações).
- Pilha: React 19 + Vite (`web/`), Fastify + SQLite `node:sqlite` (`servidor/`), módulos em `modulos/<nome>/{api,tests}`, migrações SQL em `infra/migracoes/` (rodam sozinhas ao subir o servidor), testes `node:test` (`npm test`, 78 testes).
- Rodar: `npm run dev` (site http://localhost:5174, API :3100). Logins de exemplo: admin/admin123, editor/editor123, leitor/leitor123. `npm run demo` popula dados fictícios (idempotente).
- Serviço Zimbra (separado): `MCP/zimbra-mcp` (fora do Git, tem credenciais) → `.venv\Scripts\python zimbra_web.py` (porta 8765, só local).

## 2. Telas (frontend `web/src`)
| Tela | Arquivo | Quem vê |
|---|---|---|
| Início (3 carrosséis esquerda/meio/direita, missão-visão-valores, Colaborador Destaque, comunicados, avisos, documentos recentes) | `inicio/Inicio.tsx`, `Novidades.tsx`, `Destaques.tsx`, `MissaoVisaoValores.tsx` | todos (blocos de comunicados/documentos seguem `ver.*`) |
| Comunicados (lista + detalhe) | `comunicados/Comunicados.tsx` | `ver.comunicados` |
| Documentos | `documentos/Documentos.tsx` | `ver.documentos` (+ `documentos.abrir`, `documentos.restritos`) |
| Pessoas (contatos por área) | `pessoas/Pessoas.tsx` | `ver.pessoas` |
| Ajuda (FAQ no código) | `ajuda/Ajuda.tsx` | `ver.ajuda` |
| Publicar (abas) | `gestao/Gestao.tsx` + `Crud.tsx` | `pub.<aba>.ver` |
| Configurações (abas) | `gestao/Gestao.tsx`, `Administracao.tsx`, `Permissoes.tsx`, `Integracoes.tsx` | `cfg.<aba>.ver` |
| Menu lateral + Calendário | `Menu.tsx`, `Calendario.tsx` | `ver.calendario` (criar/excluir datas: `calendario.criar/excluir`) |
| Barra de aplicativos (direita) | `aplicacoes/Lancador.tsx` | todos |
| Busca global (topo) | `BuscaGlobal.tsx` | todos (só mostra o que a pessoa pode ver) |
| Conta (avatar, senha), login, tema | `Conta.tsx`, `Login.tsx`, `tema.tsx` | todos |

Componentes-chave: `Crud.tsx` (lista+formulário genérico, ordenação por cabeçalho via `Ordenar.tsx`, `PermissoesCtx`), `CampoLink.tsx` (link do botão com pesquisa), `Permissoes.tsx` (perfis e grade de permissões). CSS: `portal.css` (blocos acrescentados no fim; o último vence) e `estilo.css` (tokens do tema). O app usa `zoom` no `<html>` (variável `--zoom`): ao posicionar elementos `fixed`, medir e corrigir.

## 3. API (servidor) por módulo
- **acessos** (`modulos/acessos/api`): login/sair/eu/senha; usuários (`/api/usuarios`), perfis (`/api/perfis`), auditoria. Permissões em `permissoes.ts`, guardas em `guard.ts` (`exigirPerm`).
- **comunicados**: `/api/comunicados[/slug]` (ler) e `/api/gestao/comunicados` (CRUD).
- **documentos**: `/api/documentos` (ler; link e restritos conforme permissão) e `/api/gestao/documentos`.
- **pessoas**: `/api/contatos` e `/api/gestao/contatos`.
- **inicio** (destaques): `/api/destaques` e `/api/gestao/destaques` (mês/ano, foto, consentimento LGPD).
- **banners**: `/api/banners` (público logado) e `/api/gestao/banners` (posição principal/lateral1/lateral2 = esquerda/meio/direita).
- **institucional**: `/api/institucional` e `PUT /api/gestao/institucional`.
- **aplicacoes**: `/api/aplicacoes`, favoritos, `/api/gestao/aplicacoes` (+ ícone automático).
- **imagens**: upload `/api/gestao/imagens` e leitura `/api/imagens/:nome` (PNG/JPG/WebP/GIF/ICO, 5 MB, sem SVG).
- **calendario**: `GET/POST /api/calendario`, `DELETE /api/calendario/:id` (via serviço Zimbra, cache 5 min).
- **integracoes**: `/api/integracoes/zimbra` (situação, conexão, testar, config do serviço, agendas).
- Proteções globais: sessão por cookie httpOnly, CSRF por origem, bloqueio por tentativas de login, auditoria só-inclusão.

## 4. Banco (migrações 001–013)
Tabelas: `usuarios` (perfil, permissões JSON de ajustes), `sessoes`, `tentativas_login`, `auditoria`, `perfis_permissoes` (nome, sistema, lista), `departamentos`, `contatos`, `aplicacoes`, `favoritos`, `comunicados`, `documentos`, `periodos_destaque`, `destaques` (mes, ano, foto), `banners`, `institucional`, `integracoes` (chave/valor: conexão com o Zimbra).

## 5. Permissões (modelo)
- Perfis: Administrador (sempre tudo), Editor, Consulta (do sistema, não apagam nem renomeiam) + perfis personalizados criados em Configurações › Perfis.
- Chaves por área, com "ver" como portão: `ver.<tela>`, `documentos.abrir|restritos`, `ver.calendario`, `calendario.criar|excluir`, `pub.<aba>.ver|criar|editar|excluir`, `cfg.usuarios.ver|criar|editar|senha`, `cfg.perfis.ver|criar|editar|excluir`, `cfg.integracoes.ver|editar`, `cfg.auditoria.ver`.
- Ajuste por usuário vale por cima do perfil. Quem não é admin só concede o que tem e nunca mexe em administradores. Servidor confere cada ação (`exigirPerm`); a interface só esconde.

## 6. Integração Zimbra (calendário de datas importantes)
- Fluxo: navegador → portal (login) → `modulos/integracoes/api/zimbra.ts` → serviço `MCP/zimbra-mcp` (Bearer token) → Zimbra.
- Configuração dentro do portal: **Configurações › Integrações** (endereço + token do serviço, agenda da empresa, conta do Zimbra, serviços ligados, agendas usadas, testar). Conexão fica na tabela `integracoes`; variáveis `ZIMBRA_API_URL/TOKEN/AGENDA` valem como alternativa.
- Privacidade: o calendário **só lê a agenda escolhida** em Integrações; sem escolha, mostra aviso e nada de eventos (a conta tem agendas pessoais e de salas que não devem ir a todos). Não repassa organizador.
- Estado em 07/11/2026: serviço no ar e conectado ao portal (conexão salva no banco local), serviço Agenda ligado; **falta escolher a agenda da empresa** na tela. Criar/excluir datas exige ligar "Criar e excluir eventos" no serviço.

## 7. O que está feito × o que falta
Feito: todos os módulos da seção 3, perfis personalizados, permissões por ação, tabelas ordenáveis, busca global, calendário + integração Zimbra configurável pela tela, banners com link pesquisável, Colaborador Destaque (mês/ano/foto), carrosséis automáticos (ignoram "reduzir animações").
Falta / decisões em aberto:
1. **Escolher a agenda da empresa** em Configurações › Integrações (e, se quiser, ligar "Criar e excluir eventos").
2. Texto oficial de Missão/Visão/Valores (hoje exemplo) e o ícone do app Meu RH.
3. "Referência do consentimento" do Colaborador Destaque: manter obrigatória ou tornar opcional (LGPD).
4. Anexos de documentos (hoje só link oficial) — decisão: arquivo fica no sistema de origem.
5. SSO corporativo, recuperação de senha por e-mail e notificações por e-mail (usariam o serviço Zimbra; faltam e-mails dos usuários), confirmação de leitura de comunicados, 2FA do admin, aviso de sessão expirando.
6. Teste visual automático (Playwright) das telas e FAQ da Ajuda editável pelo portal.
7. Produção: hospedagem com HTTPS, `ORIGENS_PERMITIDAS`, serviço Zimbra rodando como serviço do Windows (NSSM) com `ZIMBRA_API_IPS` restrito, backup do `dados-privados/`.

## 8. Operação
- Subir tudo no desenvolvimento: `npm run dev` (portal) + `MCP/zimbra-mcp/.venv/Scripts/python zimbra_web.py` (serviço). O serviço aceita configuração só de `127.0.0.1` sem cabeçalhos de proxy (por isso o portal precisa rodar na mesma máquina).
- Dados e segredos fora do Git: `dados-privados/`, `MCP/`, `.env`. Nunca colocar token/senha em docs ou testes.
- Rotina de trabalho: mudar → `npm run typecheck` → `npm test` → `npm run build` → atualizar `docs/memoria/estado-e-ponto-de-parada.md` → commit → push.
