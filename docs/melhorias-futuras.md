# Melhorias futuras

Anotações sem implementar (gatilho: "registre nas melhorias futuras").

- Dividir `app/globals.css` por módulo.
- Adicionar ESLint e testes (Vitest + Playwright desktop/mobile).
- Decidir hospedagem com autenticação antes de usar dados reais.
- **SSO corporativo:** hoje o login é local (admin master cria os usuários). Se a TI oferecer SSO (Azure AD/Google), trocar só a camada de sessão em `modulos/acessos` e manter perfis e auditoria.
- Fotos reais: trocar as capas em cor (`web/src/Capa.tsx`, aceita `foto`) por imagens aprovadas pela Marketing, com consentimento para fotos de pessoas.
- Anexos de documentos (hoje só link oficial), com antivírus e limite de tamanho.
- Recuperação de senha por e-mail (hoje o admin redefine); exige guardar e-mail dos usuários.
- Expirar/renovar sessão com aviso na tela; autenticação em dois fatores para o admin.
- Notificações de novos comunicados e confirmação de leitura (comunicados obrigatórios).
- Teste visual automático (Playwright) das telas nos 6 estilos × claro/escuro e no celular; hoje a conferência é por screenshot manual.
- Tela de Pessoas e Ajuda (itens do menu hoje marcados "em breve").
