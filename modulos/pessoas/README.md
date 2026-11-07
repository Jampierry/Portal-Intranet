# Módulo pessoas

**Escopo:** "Pessoas" no menu = **contatos por área** (canal da área: e-mail, ramal, ferramenta de chamados). Não guarda nem exibe dados pessoais de funcionários (LGPD).

**Status:** ✅ pronto. API em `api/` (`GET /api/contatos`; gestão em `/api/gestao/contatos` para editor e admin), tela em `web/src/pessoas/`, gestão na aba Gestão › Contatos.

**Regras:** só aparece o que estiver marcado como publicável; a área (departamento) é criada na hora ao cadastrar um contato; toda alteração vai para a auditoria.

Regras gerais: ver `../../CLAUDE.md`.
