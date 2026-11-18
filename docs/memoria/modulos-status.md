# Status dos módulos

| Módulo | Status | Nota |
|---|---|---|
| shell (App, Menu, tema, barra superior) | ✅ | Menu esquerdo enxuto, barra superior universal, barra de aplicativos à direita, tema Di Paula + 5 estilos, modo compacto |
| acessos | ✅ | Login local, perfis admin/editor/consulta, usuários, troca de senha, auditoria (só inclusão) |
| inicio | ✅ | Faixa de novidades (banner padrão se adapta à altura da faixa), pessoas em destaque (exige consentimento), comunicados, avisos importantes, documentos recentes |
| comunicados | ✅ | Lista, detalhe e gestão (rascunho, publicar, arquivar, janela de exibição) |
| documentos | ✅ | Versão, responsável, revisão, classificação; origem = link, pasta do portal ou pasta do servidor cadastrada (Configurações › Pastas de documentos) com seletor e pesquisa. Anexos ⬜ |
| aplicacoes | ✅ | Barra da direita (favoritos por usuário no servidor) + Gestão › Aplicativos (cadastro: admin) |
| pessoas | ✅ | Contatos por área, sem dados pessoais; gestão na aba Contatos |
| ajuda | ✅ | FAQ em `web/src/ajuda/Ajuda.tsx` (texto no código) |
| publicar | ✅ | Editor/admin: abas Comunicados, Documentos, Colaborador Destaque, Contatos, Aplicativos (`#publicar/<aba>`; código em `web/src/gestao/Gestao.tsx`, rotas da API seguem em `/api/gestao/*`) |
| banners / institucional | ✅ | Banners do carrossel do Início e texto de missão, visão e valores (Publicar › Banners / Missão, Visão e Valores) |
| configurações | ✅ | Abas liberadas por permissão: Usuários, Perfis (criar/editar perfis, grade por tela/aba), Integrações (Zimbra) e Auditoria (`#configuracoes/<aba>`). Endereços antigos `#gestao/...` redirecionam |
| calendario / integracoes | ✅ | **CalDAV direto** (17/11, `integracoes/api/caldav.ts`, prioridade sobre o zimbra-mcp; não testado com o Zimbra real). Calendário no menu lendo uma agenda escolhida do Zimbra (serviço `MCP/zimbra-mcp`), cadastro/exclusão de datas por permissão; configuração na aba Integrações |
| busca global | ✅ | Busca do topo agrupa comunicados, documentos, aplicativos e contatos conforme as permissões |

Testes: **205** em 17/11/2026 (eram 147 em 12/11 (API com banco em memória + contraste + links). Módulos novos desde então: pulso (Pesquisas), aprovacoes, redes, pessoasmes, avisos, push, propriedade, perfil, marca, demonstracao. Visão atual: `../README.md`. Detalhes: `../roteiro-modulos.md` e `../requisitos.md`.

- **Publicar › Aprovações / Redes sociais** (12/11/2026): fila do RH para comunicados, redes, banners e documentos; aprovação definida por aba e por usuário (`pub.<aba>.aprovacao`); anexos nas redes. Ver `estado-e-ponto-de-parada.md`.

- **Escala automática** (13/11/2026): telas menores que 1600×860 reduzem o portal na proporção (layout igual ao de monitor grande), com letra mínima de 10 px reais; ver `../arquitetura.md`. Também: calendário do menu com painel lateral, calendário tela cheia e barra de apps otimizados para celular, datas na borda de baixo dos avatares, rótulo "Espaço de trabalho" removido. Testes: 165.

- **Meu perfil** (12/11/2026): contato, emergência, foto e e-mail; ficha de emergência para admin/permissão `cfg.usuarios.emergencia` (auditada).

- **Biometria, manter conectado e Uso do portal** (16/11/2026): passkeys WebAuthn (`modulos/biometria`, só em HTTPS/localhost; validar no iPhone quando a TI liberar o HTTPS), sessão de 30 dias opcional, painel Configurações › Uso do portal identificado por pessoa e departamento (`modulos/uso`, permissão `cfg.uso.ver`, retenção de 12 meses, consulta auditada), departamento por usuário. 45 testes de tela e 182 testes. Detalhes em `estado-e-ponto-de-parada.md`.
- **Mídia no disco, Playwright, manuais com prints, logo oficial, revisão de código** (13/11/2026): imagens, vídeos e anexos em `PASTA_MIDIA`; `npm run e2e` (40 testes de tela, incluindo aprovação, pesquisa, permissões, confirmação de leitura e pedido de edição); prints com setas nos 4 manuais (`npm run manuais:prints`); logo oficial em `web/public/marca` + `npm run marca:logo`; correções de segurança (escalada de privilégio por perfil, chave de login, push). Detalhes em `estado-e-ponto-de-parada.md`.

- **Publicação na plataforma e login pelo Keycloak** (16–17/11/2026): `Dockerfile`/`docker-compose.yml`/`app.yml`/workflow do template; homologação em https://portal-hml.apps.dipaula.com.br; `modulos/keycloak` (SSO, cria Consulta sem cadastro); `modo debug`; novo ícone ("D" itálico); login com mensagens que não estouram o cartão.

- **Prévias, documentos e usuários** (17/11/2026): prévia ao vivo nos cadastros de Publicar, ícone "!" de ajuda, painéis por cima de pop-ups (`flutuante.ts`), carrosséis e quadros de pessoas sempre visíveis, documentos com versão/responsável automáticos, envio do computador, miniatura da página e cartões fixos, Usuários com busca/filtros e aba Sem cadastro (Keycloak), volume `portal_arquivos`. Ver `estado-e-ponto-de-parada.md`.
