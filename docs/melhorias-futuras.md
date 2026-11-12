# Melhorias futuras

Anotações sem implementar (gatilho: "registre nas melhorias futuras").

- Dividir `app/globals.css` por módulo.
- Adicionar ESLint e testes (Vitest + Playwright desktop/mobile).
- Decidir hospedagem com autenticação antes de usar dados reais.
- **SSO corporativo:** hoje o login é local (admin master cria os usuários). Se a TI oferecer SSO (Azure AD/Google), trocar só a camada de sessão em `modulos/acessos` e manter perfis e auditoria.
- Fotos reais: trocar as capas em cor (`web/src/Capa.tsx`, aceita `foto`) por imagens aprovadas pela Marketing, com consentimento para fotos de pessoas.
- Anexos de documentos: o arquivo já pode vir de pasta do portal ou do servidor; falta antivírus e limite de tamanho.
- Recuperação de senha por e-mail (hoje o admin redefine); exige guardar e-mail dos usuários.
- Expirar/renovar sessão com aviso na tela; autenticação em dois fatores para o admin.
- ~~Notificações de novos comunicados e confirmação de leitura~~ — **feito** (sino, e-mail, push e "Li e estou ciente").
- Teste visual automático (Playwright) das telas nos 6 estilos × claro/escuro e no celular; hoje a conferência é por screenshot manual.
- ~~Telas de Pessoas (Contatos) e Ajuda~~ — **feito**. A Ajuda precisa de texto novo (ver revisão).

## Registradas em 12/11/2026 (revisão do sistema)
Ver a lista completa e priorizada em [revisao-do-sistema-2026-11-12.md](revisao-do-sistema-2026-11-12.md). Resumo: limite de login por IP, CSP/HSTS, política de senha, ESLint + CI + testes de tela, dividir `portal.css`, reescrever a Ajuda, manuais dentro do portal, exportar resultado de pesquisas, recuperação de senha por e-mail, 2FA/SSO, avatar no servidor, monitoramento e política de retenção (LGPD).
