# Melhorias futuras

Atualizada em 12/11/2026 (gatilho: "registre nas melhorias futuras"). O que **a TI** precisa fazer está em [pendências da TI](pendencias-ti.md). O histórico da análise está em [revisão do sistema](revisao-do-sistema-2026-11-12.md).

## Já feito (para não repetir)
Limite de login por login+IP, por IP e por login · CSP, Permissions-Policy e HSTS em produção · política de senha · Ajuda reescrita, com **manuais dentro do portal** · exportar resultados de pesquisas em CSV · ESLint e CI (`.github/workflows/ci.yml`) · `portal.css` dividido em `web/src/css/parte-NN.css` · monitoramento do tamanho do banco · notificações, confirmação de leitura, Pessoas (Contatos) e Ajuda.

## Código (podemos fazer)
| Prioridade | Melhoria | Observação |
|---|---|---|
| Alta | **Manuais por perfil** (ex.: Marketing) | Cada perfil teria o seu manual (`docs/manuais/perfil-<nome>.md`), visto só por quem tem o perfil; hoje a tela escolhe por prefixo de permissão (`pub.`, `cfg.`). Exige permissões mais específicas para o manual de RH. |
| Alta | **2FA por TOTP** para administradores | Não depende de provedor externo. |
| Média | Teste do CSV de exportação com respostas reais | O teste atual aceita 200 ou 409. |
| Média | Atraso progressivo no login | Hoje só há bloqueio de 15 min. |
| Média | Aviso de expiração da sessão e "sair de todos os aparelhos" | A sessão é fixa de 12 h, sem aviso. |
| Média | **Testes de tela (Playwright)**: login, publicar com aprovação, responder pesquisa, em computador e celular | Nada exercita o React hoje. Também cobriria o teste visual dos 6 estilos × claro/escuro. |
| Média | **Imagens, fotos e anexos fora do SQLite** (em disco, com o banco só no índice) | Reduz o tamanho do banco e do backup. |
| Média | Consolidar regras CSS repetidas (ex.: `.entrar`, `.rodape-portal`) e padronizar alturas com `--zoom` | Exige teste visual; ver `web/src/css/LEIA-ME.md`. |
| Média | Auditoria: política de retenção e exportação para a TI | Depende da decisão de LGPD. |
| Baixa | Avatar guardado no servidor | Hoje o avatar escolhido fica só no navegador; a foto já vale em qualquer aparelho. |
| Baixa | Foto de perfil nos cartões de Contatos e no Colaborador Destaque | Hoje aparece só no menu da conta e no Meu perfil. |
| Baixa | Relatórios de uso (leitura de comunicados por área, adesão às pesquisas) | |
| Baixa | Comparar rodadas de pesquisa e exportar também em PDF | O CSV já existe. |
| Baixa | Modo "sem animações" nas preferências | Já respeita `prefers-reduced-motion`. |
| Baixa | Textos da Ajuda em arquivo ou banco, editáveis pelo RH | Hoje estão no código (`web/src/ajuda/Ajuda.tsx`). |
| Baixa | Versionamento (`v1.0.0`) e `CHANGELOG` | |
| Baixa | Dividir arquivos grandes (`pulso/api`, `Gestao.tsx`, `App.tsx`, `Administracao.tsx`) quando forem mexidos | |
| Baixa | Padronizar `exigirPerm('...')` na própria rota; um teste de permissão e de propriedade por módulo novo | |
| Baixa | Auditoria manual de acessibilidade (leitor de tela, teclado, pop-ups, carrosséis, cartão de vidro do login) | |

## Depende de ferramenta ou serviço externo
- **Recuperação de senha por e-mail** (hoje o administrador redefine): exige SMTP/Zimbra em produção e o e-mail guardado em cada usuário.
- **SSO corporativo** (Azure AD/Google): trocar só a camada de sessão em `modulos/acessos`, mantendo perfis e auditoria.
- **Antivírus nos anexos**: exige o antivírus da TI.
- **Fotos reais** nas capas (`web/src/Capa.tsx` aceita `foto`): imagens aprovadas pelo Marketing, com consentimento para fotos de pessoas.

## Decisões do negócio
Bloqueiam o uso de dados reais:
- Validar **marca, cores, logo e fonte** com o Marketing (hoje provisórios).
- **LGPD:** base legal e responsável para contato de emergência e observação de saúde; texto de consentimento do Colaborador Destaque; por quanto tempo guardar respostas, auditoria e fotos; exclusão quando a pessoa sai.
- **Governança:** quem publica o quê, quem aprova (RH) e quais perfis existirão (hoje: Administrador, Editor, Consulta e RH de exemplo).
- Trocar o conteúdo fictício (empresa Aurora) pelos dados reais, só depois do acima.

## Conferências que dependem de pessoas
- Conferir no iPhone os carrosséis, o topo e o login.
- Passar o teste visual nos 6 estilos × claro/escuro × celular (sem automação).
- "Início cortado": ainda não reproduzido; reabrir com a largura da janela em que aparece.
