# Status dos módulos

| Módulo | Status | Nota |
|---|---|---|
| shell (App, Menu, tema, barra superior) | ✅ | Menu esquerdo enxuto, barra superior universal, barra de aplicativos à direita, tema Di Paula + 5 estilos, modo compacto |
| acessos | ✅ | Login local, perfis admin/editor/consulta, usuários, troca de senha, auditoria (só inclusão) |
| inicio | ✅ | Faixa de novidades, pessoas em destaque (exige consentimento), comunicados, avisos importantes, documentos recentes |
| comunicados | ✅ | Lista, detalhe e gestão (rascunho, publicar, arquivar, janela de exibição) |
| documentos | ✅ | Versão, responsável, revisão, classificação; origem = link, pasta do portal ou pasta do servidor cadastrada (Configurações › Pastas de documentos) com seletor e pesquisa. Anexos ⬜ |
| aplicacoes | ✅ | Barra da direita (favoritos por usuário no servidor) + Gestão › Aplicativos (cadastro: admin) |
| pessoas | ✅ | Contatos por área, sem dados pessoais; gestão na aba Contatos |
| ajuda | ✅ | FAQ em `web/src/ajuda/Ajuda.tsx` (texto no código) |
| publicar | ✅ | Editor/admin: abas Comunicados, Documentos, Colaborador Destaque, Contatos, Aplicativos (`#publicar/<aba>`; código em `web/src/gestao/Gestao.tsx`, rotas da API seguem em `/api/gestao/*`) |
| banners / institucional | ✅ | Banners do carrossel do Início e texto de missão, visão e valores (Publicar › Banners / Missão, Visão e Valores) |
| configurações | ✅ | Abas liberadas por permissão: Usuários, Perfis (criar/editar perfis, grade por tela/aba), Integrações (Zimbra) e Auditoria (`#configuracoes/<aba>`). Endereços antigos `#gestao/...` redirecionam |
| calendario / integracoes | ✅ | Calendário no menu lendo uma agenda escolhida do Zimbra (serviço `MCP/zimbra-mcp`), cadastro/exclusão de datas por permissão; configuração na aba Integrações |
| busca global | ✅ | Busca do topo agrupa comunicados, documentos, aplicativos e contatos conforme as permissões |

Testes: **147** em 12/11/2026 (API com banco em memória + contraste + links). Módulos novos desde então: pulso (Pesquisas), aprovacoes, redes, pessoasmes, avisos, push, propriedade, perfil, marca, demonstracao. Visão atual: `../README.md`. Detalhes: `../roteiro-modulos.md` e `../requisitos.md`.

- **Publicar › Aprovações / Redes sociais** (12/11/2026): fila do RH para comunicados, redes, banners e documentos; aprovação definida por aba e por usuário (`pub.<aba>.aprovacao`); anexos nas redes. Ver `estado-e-ponto-de-parada.md`.

- **Escala automática** (13/11/2026): telas menores que 1600×860 reduzem o portal na proporção (layout igual ao de monitor grande), com letra mínima de 10 px reais; ver `../arquitetura.md`. Também: calendário do menu com painel lateral, calendário tela cheia e barra de apps otimizados para celular, datas na borda de baixo dos avatares, rótulo "Espaço de trabalho" removido. Testes: 165.

- **Meu perfil** (12/11/2026): contato, emergência, foto e e-mail; ficha de emergência para admin/permissão `cfg.usuarios.emergencia` (auditada).

- **Mídia no disco, Playwright, manuais com prints, logo oficial, revisão de código** (13/11/2026): imagens, vídeos e anexos em `PASTA_MIDIA`; `npm run e2e` (33 testes de tela); prints com setas nos 4 manuais (`npm run manuais:prints`); logo oficial em `web/public/marca` + `npm run marca:logo`; correções de segurança (escalada de privilégio por perfil, chave de login, push). Detalhes em `estado-e-ponto-de-parada.md`.
