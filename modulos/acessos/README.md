# Módulo acessos

**Escopo:** login local, perfis, administração de usuários e auditoria. O **administrador master** cria os logins.

**Status:** ✅ pronto (API em `api/`, testes em `tests/`, telas em `web/src/Login.tsx`, `Conta.tsx`, `gestao/Administracao.tsx`).

## Como funciona
- **Perfis:** `admin` (master: tudo, inclusive usuários, aplicações e auditoria), `editor` (comunicados, documentos e destaques) e `consulta` (só lê).
- **Sessão:** cookie `portal_sessao` (httpOnly, SameSite=Lax, `Secure` em produção), 12 h. No banco fica só o hash (SHA-256) do token.
- **Sistema fechado:** toda a `/api` exige login, exceto `/api/saude` e `/api/login`.
- **Senhas:** scrypt com sal; mínimo de 8 caracteres. O admin cria o usuário com **senha provisória**; no primeiro acesso (ou após redefinição) o portal só libera depois da troca.
- **Bloqueio:** 5 falhas em 15 min bloqueiam o login (mensagem genérica: não revela se o login existe).
- **Proteções:** não deixa o sistema sem administrador ativo; desativar/rebaixar derruba as sessões; mudanças de outra origem são recusadas (`ORIGENS_PERMITIDAS`).
- **Auditoria:** tabela só de inclusão (o próprio banco bloqueia UPDATE/DELETE); nunca grava senha. Tela: Gestão › Auditoria.

## Primeiro administrador (produção)
```
npm run admin:criar -- maria.admin "Maria da Silva"
```
Mostra uma senha provisória uma única vez (ou use `ADMIN_SENHA`). Rodar de novo com o mesmo login redefine a senha e reativa o acesso. Em desenvolvimento, `npm run banco:seed` cria `admin/admin123`, `editor/editor123` e `leitor/leitor123` (nunca em produção).

Regras gerais: ver `../../CLAUDE.md`.
