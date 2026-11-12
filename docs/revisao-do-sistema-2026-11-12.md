# Revisão do sistema — 12/11/2026

Revisão feita sobre o código e a documentação do repositório (`main`). Verificações rodadas: `npm run typecheck`, `npm run build`, `npm test` (**147 testes, todos passando**) e `npm audit --omit=dev` (**0 vulnerabilidades**). **Limite da revisão:** as telas não foram percorridas num navegador nesta revisão, então os itens visuais abaixo vêm de relatos e do código, não de teste visual.

## 0. Andamento (atualizado em 12/11/2026, à noite)
**Feito no código:** (1) bloqueio de login por login+IP, por IP e por login (limite alto), sem travar a conta de quem só tem o login visado; (2) CSP restritiva (com hash do script de tema), `Permissions-Policy`, COOP e HSTS quando a requisição chega por HTTPS; (3) política de senha (comum, variedade, número/símbolo); (4) Ajuda reescrita (Pesquisas, Meu perfil, sino, aprovação, propriedade, calendário); (5) exportar resultados das pesquisas em CSV (botão no Resultado; respeita anonimato, mínimo de respostas e protege contra fórmula); (6) ESLint (`npm run lint`) e CI no GitHub (`.github/workflows/ci.yml`); (7) `portal.css` dividido em 9 partes, mantendo a cascata (CSS compilado idêntico); (8) monitoramento do tamanho do banco (`GET /api/gestao/armazenamento`, só com permissão de auditoria).
**Não feito (depende de terceiros ou de decisão):** itens de TI (2.1), marca/LGPD (2.2), recuperação de senha por e-mail (exige SMTP/Zimbra em produção), 2FA/SSO (exige escolha do provedor), antivírus nos anexos (exige o antivírus da TI), testes de tela com Playwright, mover imagens/anexos do SQLite para o disco, consolidar regras CSS repetidas (exige teste visual), atraso progressivo no login e aviso de expiração da sessão.

## 1. Resumo
O portal está **funcionalmente completo para a fase de dados fictícios**: 21 módulos de API (~160 rotas), 47 migrações, login local com perfis e permissões por tela e aba, publicação com aprovação do RH, pesquisas com resultado liberável, avisos (sino, e-mail, push), calendário, Meu perfil, 6 estilos de tema e experiência em computador e celular.

O que separa o sistema de uma **produção com dados reais** é, principalmente, **infraestrutura da TI** e **endurecimento de segurança**, mais alguma **dívida de código** (CSS e testes de tela) e a **atualização de textos** (Ajuda e documentos antigos).

## 2. O que ainda falta fazer

### 2.1 Depende da TI (bloqueia a ida para produção)
Checklist para a TI: [pendencias-ti.md](pendencias-ti.md). Lista de melhorias: [melhorias-futuras.md](melhorias-futuras.md).

| Item | Por quê |
|---|---|
| Servidor e nome interno (ex.: `portal.empresa.com.br`) | o portal precisa de endereço fixo |
| **HTTPS** com proxy reverso (IIS, nginx ou Caddy) | sem HTTPS o login não funciona em produção (cookie `Secure`) e o **push** não funciona |
| Conta de serviço e gerenciador de processo (NSSM, systemd ou PM2) | subir sozinho e reiniciar se cair |
| **Backup agendado** do banco e da pasta de documentos, e **teste de restauração** | o CLI `npm run backup` existe; falta quem agende e valide |
| Permissão de **leitura** nas pastas de rede dos documentos | o usuário do serviço precisa ler as origens |
| Liberar a porta 5174 no firewall (desenvolvimento em rede) | precisa de administrador |
| Zimbra/OAuth em produção (endereço de retorno real no Google e na Microsoft) | e-mail e agenda reais |

### 2.2 Antes de usar dados reais (decisões de negócio e conformidade)
- **Validar marca, cores, logo e fonte com o Marketing** (hoje provisórios).
- **LGPD:** definir base legal e responsável para contato de emergência e observação de saúde; revisar o texto de consentimento do Colaborador Destaque; definir **por quanto tempo** guardar respostas, auditoria e fotos; política de exclusão quando a pessoa sai.
- **Governança:** quem pode publicar o quê, quem aprova (RH) e quais perfis existirão de fato. Hoje só existem Administrador, Editor, Consulta e RH de exemplo.
- Trocar o conteúdo fictício (seed, empresa Aurora) pelos dados reais, só depois do acima.
- Rodar uma **revisão de segurança completa** (a desta sessão cobriu só o código novo e uma varredura de injeção SQL e dependências).

### 2.3 Funcionalidades previstas e ainda não feitas
- **Resultado das pesquisas:** exportar (CSV/PDF) e comparar rodadas.
- **Recuperação de senha por e-mail** (hoje o administrador redefine).
- **Autenticação em dois fatores** para o administrador e **SSO** corporativo (Azure AD/Google), trocando só a camada de sessão em `modulos/acessos`.
- **Antivírus** nos anexos e limites por tipo.
- **Fotos reais** aprovadas pelo Marketing nas capas.
- **Mobile:** conferir no iPhone os carrosséis, o topo e o login (o login vitrificado já foi conferido no navegador do computador).
- **Foto no restante do portal:** a foto de perfil aparece no menu da conta e no Meu perfil; os cartões de Contatos e o Colaborador Destaque ainda não a usam.
- **Relatórios** de uso (leitura de comunicados por área, adesão às pesquisas).

### 2.4 Pendências visuais e de conferência
- **Conferido pelo usuário no navegador (12/11/2026):** ficha de Contato, bloco Avatar, login vitrificado e barra inferior. Nada pendente nesses itens.
- **Início cortado** e a mancha alaranjada abaixo da barra inferior: **não são mais tratados como pendência** (sem reprodução; reabrir se voltarem a aparecer).
- Passar o **teste visual** nos 6 estilos × claro/escuro × celular (continua sem automação).

## 3. O que precisa melhorar

### 3.1 Segurança (prioridade alta)
1. **Bloqueio de login só por nome de usuário**, sem limite por IP: quem conhece o login de alguém pode **bloquear a conta dela** por 15 minutos repetidamente (negação de serviço), e não há freio para varrer muitos logins. *Ação:* limitar também por IP e por janela, com atraso progressivo, e não revelar se o login existe.
2. **Sem Content-Security-Policy** na aplicação (só nos SVGs): hoje há `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`. *Ação:* CSP restritiva (`default-src 'self'`) e `Strict-Transport-Security` em produção.
3. **Política de senha** só exige 8 caracteres. *Ação:* bloquear senhas comuns e a igual ao login; avaliar expiração apenas se a TI exigir.
4. **Sessão fixa de 12 h**, sem aviso na tela e sem lista de sessões/encerrar todas. *Ação:* aviso de expiração e "sair de todos os aparelhos".
5. **Imagens, fotos e anexos ficam no banco SQLite**: o arquivo cresce rápido e o backup fica pesado. *Ação:* monitorar o tamanho; considerar guardar arquivos em disco com o banco só no índice.
6. **Auditoria só de inclusão, mas sem retenção definida** nem exportação. *Ação:* política de retenção e exportação para a TI.
7. Conferir `ORIGENS_PERMITIDAS`, `TRUST_PROXY` e o servidor em `127.0.0.1` atrás do proxy no dia da implantação (já documentado em [implantação](implantacao.md)).

### 3.2 Qualidade de código
- **`portal.css` com 2.196 linhas e regras sobrepostas** ("o último vence"): por exemplo `.entrar` é definida em 4 pontos e `.rodape-portal` em 8. Cada ajuste novo vira mais um bloco no fim, o que dificulta a manutenção e causou bugs (altura sem considerar o zoom). *Ação:* dividir por módulo, consolidar regras duplicadas e usar uma única fonte para alturas com `--zoom`.
- **Sem ESLint, sem integração contínua (CI) e sem testes de tela** (Playwright). Os 147 testes cobrem a API, o contraste dos temas e as regras de links; **nada exercita o React**. *Ação:* ESLint, workflow de CI (`npm run publicar`) e testes de tela dos fluxos críticos (login, publicar com aprovação, responder pesquisa) em computador e celular.
- **Arquivos grandes:** `modulos/pulso/api/index.ts` (391 linhas), `gestao/Gestao.tsx`, `App.tsx`, `Administracao.tsx`. *Ação:* dividir por responsabilidade quando forem mexidos de novo.
- **Cobertura desigual:** `redes` não tem pasta de testes própria (é coberta por `aprovacoes`); vários módulos têm um teste só. *Ação:* um teste de permissão e de propriedade para cada módulo novo.
- **Rotas com guarda por variável** (por exemplo em `acessos` e `calendario`) são mais difíceis de auditar. *Ação:* padronizar `exigirPerm('...')` na própria rota.

### 3.3 Experiência de uso
- **A tela Ajuda está desatualizada:** não fala de Pesquisas, Meu perfil, avisos push/e-mail, aprovação, calendário nem do pedido de autorização de edição, e diz "Minha conta › Trocar senha". *Ação:* reescrever a FAQ com base nos novos manuais (`docs/manuais/`) e, de preferência, guardar o texto em arquivo/banco para o RH poder editar.
- **Manuais dentro do portal:** hoje estão só no repositório. *Ação:* publicar os manuais como documentos do portal (ou páginas da Ajuda).
- **Colaborador sem foto/avatar sincronizado:** o avatar escolhido fica só no navegador; a foto vale em qualquer aparelho. *Ação:* guardar também o avatar no servidor.
- **Pesquisas no celular e rolagem de resultados:** conferir a usabilidade com muitas perguntas.
- **Acessibilidade:** o projeto tem teste de contraste, mas falta uma **auditoria manual** com leitor de tela e teclado (principalmente nos pop-ups, carrosséis e no novo cartão de vidro do login, cujo contraste depende da imagem de fundo).
- **Animações:** o fundo animado do login e os carrosséis respeitam `prefers-reduced-motion`; vale um modo "sem animações" também nas preferências.

### 3.4 Operação
- **Monitoramento:** só existe `/api/saude`. *Ação:* alerta de queda, espaço em disco, tamanho do banco e falha de backup.
- **Logs:** definir onde ficam e por quanto tempo.
- **Ambientes:** documentar o ambiente de teste com cópia do banco e e-mail/integrações desligados (já descrito em [implantação](implantacao.md); falta executar).
- **Versionamento:** adotar etiquetas (`v1.0.0`) e um `CHANGELOG`.

## 4. Documentação: situação e ajustes feitos nesta revisão
- **Criados:** `docs/README.md`, `arquitetura.md`, `referencia-api.md` (gerada do código), `banco-de-dados.md`, `permissoes-e-perfis.md`, quatro manuais em `docs/manuais/` e este documento.
- **Estavam defasados e foram marcados/atualizados:** `memoria/mapa-do-sistema.md` e `memoria/modulos-status.md` (diziam 79 testes e migrações 001–014), `melhorias-futuras.md` (itens já feitos, como notificações, confirmação de leitura e telas de Pessoas e Ajuda) e `roteiro-modulos.md` (futuros já entregues).
- **Mantidos como estão:** `implantacao.md`, `requisitos.md`, `decisoes.md`, `comparativo-mercado.md`, `avaliacao-estrutura.md` (histórico de 06/11) e `origem-manus/` (histórico).
- **Regra daqui em diante:** ao fechar um módulo, atualizar `referencia-api.md` (nova rota = nova linha) e o manual correspondente.

## 5. Ordem sugerida
1. **TI:** servidor, HTTPS, backup e leitura nas pastas (desbloqueia tudo).
2. **Segurança:** limite de login por IP, CSP/HSTS e política de senha (1 a 2 dias).
3. **Conteúdo:** reescrever a Ajuda e publicar os manuais no portal.
4. **LGPD e governança:** decisões de negócio antes de qualquer dado real.
5. **Qualidade:** ESLint, CI e testes de tela; depois dividir o CSS.
6. **Funcionalidades:** exportar resultados, recuperação de senha por e-mail, 2FA/SSO.
