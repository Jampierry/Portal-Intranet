# Status dos módulos

| Módulo | Status | Nota |
|---|---|---|
| shell (App, Menu, tema, barra superior) | ✅ | Menu esquerdo enxuto, barra superior universal, barra de aplicativos à direita, tema Di Paula + 5 estilos, modo compacto |
| acessos | ✅ | Login local, perfis admin/editor/consulta, usuários, troca de senha, auditoria (só inclusão) |
| inicio | ✅ | Faixa de novidades, pessoas em destaque (exige consentimento), comunicados, avisos importantes, documentos recentes |
| comunicados | ✅ | Lista, detalhe e gestão (rascunho, publicar, arquivar, janela de exibição) |
| documentos | ✅ | Versão, responsável, revisão, link oficial, classificação; gestão. Anexos ⬜ |
| aplicacoes | ✅ | Barra da direita (favoritos por usuário no servidor) + Gestão › Aplicativos (cadastro: admin) |
| pessoas | ✅ | Contatos por área, sem dados pessoais; gestão na aba Contatos |
| ajuda | ✅ | FAQ em `web/src/ajuda/Ajuda.tsx` (texto no código) |
| publicar | ✅ | Editor/admin: abas Comunicados, Documentos, Colaboradores Destaque, Contatos, Aplicativos (`#publicar/<aba>`; código em `web/src/gestao/Gestao.tsx`, rotas da API seguem em `/api/gestao/*`) |
| configurações | ✅ | Só admin: abas Usuários, Perfis (tabela informativa) e Auditoria (`#configuracoes/<aba>`). Endereços antigos `#gestao/...` redirecionam |

Testes: 41 (API com banco em memória + contraste + links). Detalhes: `../roteiro-modulos.md` e `../requisitos.md`.
