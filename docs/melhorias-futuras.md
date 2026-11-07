# Melhorias futuras

Anotações sem implementar (gatilho: "registre nas melhorias futuras").

- Dividir `app/globals.css` por módulo.
- Adicionar ESLint e testes (Vitest + Playwright desktop/mobile).
- Decidir hospedagem com autenticação antes de usar dados reais.
- **Login / acessos (decisão pendente):** `docs/requisitos.md` deixa login real, papéis e SSO fora do primeiro corte. Decidir com TI (SSO corporativo x login local) antes de implementar; hoje o nome do topo ("Bem-vindo(a)") vem de um perfil local no navegador (`web/src/perfil.tsx`) e deve passar a vir do usuário logado.
- Fotos reais: trocar as capas em cor (`web/src/Capa.tsx`, aceita `foto`) por imagens aprovadas pela Marketing, com consentimento para fotos de pessoas.
- Gestão de comunicados (criar/publicar/arquivar) e anexos de documentos, depois do login.
- Teste visual automático (Playwright) das telas nos 6 estilos × claro/escuro e no celular; hoje a conferência é por screenshot manual.
- Tela de Pessoas e Ajuda (itens do menu hoje marcados "em breve").
