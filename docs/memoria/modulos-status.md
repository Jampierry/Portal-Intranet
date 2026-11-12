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

Testes: 78 (API com banco em memória + contraste + links). Detalhes: `../roteiro-modulos.md` e `../requisitos.md`.

- **Publicar › Aprovações / Redes sociais** (12/11/2026): fila do RH para comunicados, redes, banners e documentos; aprovação definida por aba e por usuário (`pub.<aba>.aprovacao`); anexos nas redes. Ver `estado-e-ponto-de-parada.md`.
