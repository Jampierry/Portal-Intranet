# Implantação: desenvolvimento, teste e produção

O portal roda em **três ambientes**, cada um com seu banco e seu `.env`. O código é o mesmo; muda só a configuração.

| | Desenvolvimento | Teste (homologação) | Produção |
|---|---|---|---|
| Onde | computador de quem desenvolve | servidor, porta/nome separado | servidor, nome oficial |
| Como sobe | `npm run dev` (Vite 5174 + API 3100) | `npm start` (modo produção) | `npm start` (modo produção) |
| Banco | `dados-privados/portal.db` (dados de exemplo) | **cópia** do banco de produção | real |
| `.env` | não usa | `servidor/.env` do teste | `servidor/.env` da produção |

Regra de ouro: **a mesma versão (etiqueta do Git) passa pelo teste antes da produção.**

## Requisitos do servidor
- Node 24 ou superior e Git. Serve Windows ou Linux.
- **HTTPS** com nome interno (ex.: `portal.suaempresa.com.br`) por proxy reverso (IIS, nginx, Caddy). Sem HTTPS o login não funciona em produção, porque o cookie de sessão é `Secure`.
- Um gerenciador de processo para o portal subir sozinho e reiniciar se cair (serviço do Windows via NSSM, ou systemd/PM2 no Linux). Comando do serviço: `npm start` na raiz do projeto.
- Backup agendado do banco e da pasta de documentos (abaixo).

## Configuração (`servidor/.env`)
Modelo em `.env.example` (raiz). Principais variáveis:
- `NODE_ENV=production` — ativa o modo produção (cookie seguro, cabeçalhos de segurança, site compilado servido pelo servidor, logs).
- `ORIGENS_PERMITIDAS` — endereço público com https. **Obrigatória:** o servidor se recusa a subir sem ela.
- `WEBAUTHN_RP_ID` (opcional) — nome do portal usado pela biometria (ex.: `portal.suaempresa.com.br`); sem ele vale o nome do endereço aberto. A biometria (digital/rosto) só funciona em HTTPS e com endereço com nome (não IP); trocar o nome do portal depois invalida as biometrias cadastradas. `WEBAUTHN_RP_NOME` (opcional) é o nome exibido pelo aparelho.
- `PORTA`, `HOST` (padrão `127.0.0.1`, atrás do proxy) e `TRUST_PROXY=1`.
- `BANCO` — caminho do banco SQLite do ambiente.
- `PASTA_MIDIA` — pasta das imagens, vídeos e anexos enviados (padrão: `midia/` ao lado do arquivo do banco). O usuário do serviço precisa gravar nela. **Entra no backup**: `npm run backup` copia a pasta para `<PASTA_BACKUP>/midia` (só o que ainda não está lá). Ao subir pela primeira vez depois da atualização, o portal move para o disco o que ainda estava dentro do banco (faça `npm run backup` antes).
- `DOCUMENTOS_PASTA` — pasta dos documentos servidos pelo portal. O usuário que roda o serviço precisa ler essa pasta.
- `PASTA_BACKUP`, `BACKUP_MANTER_DIAS`.
- **Logo oficial:** depois de migrar o banco do ambiente, rode `npm run marca:logo` (instala a logo oficial, clara e escura, de `web/public/marca/` em Configurações › Empresa). Não altera o resto da configuração.
- **Proxy reverso:** vídeos de banners e da tela de entrada chegam a 40 MB; o limite de envio do proxy precisa ser maior (nginx `client_max_body_size 45m`; IIS `maxAllowedContentLength` acima de 45 MB).
- `PERMITIR_DADOS_EXEMPLO=1` — só no teste, se quiser ligar os dados fictícios. Em produção fica bloqueado.

## Primeira instalação
```
git clone https://github.com/Jampierry/Portal-Intranet.git
cd Portal-Intranet
git checkout <etiqueta, ex.: v1.0.0>
npm ci
copiar .env.example para servidor/.env e ajustar
npm run build
npm run migrar -w servidor          # cria o banco
npm run admin:criar -- <login> "<Nome completo>"   # primeiro administrador; mostra a senha provisória uma vez
npm start                           # ou iniciar o serviço
```
No primeiro acesso o administrador troca a senha. **Não rode `banco:seed` nem `demo` em produção** (o seed já se recusa).

## Publicar uma atualização
Mesmo roteiro no **teste** e depois na **produção**:
1. No desenvolvimento: `npm run publicar` (typecheck + testes + build). Commit, push e etiqueta (`git tag v1.1.0 && git push --tags`).
2. No servidor: `npm run backup` (**antes de tudo**).
3. `git fetch --tags && git checkout v1.1.0`, `npm ci`, `npm run build`.
4. Reiniciar o serviço. As migrações do banco rodam sozinhas na partida e aparecem no log.
5. Conferir `/api/saude` e entrar no portal.

## Voltar atrás (rollback)
Migrações só avançam, então a volta usa o backup:
1. Parar o serviço.
2. Restaurar o arquivo do banco a partir do backup feito no passo 2.
3. `git checkout <etiqueta anterior>`, `npm ci`, `npm run build`, iniciar o serviço.

## Backup
- `npm run backup` gera `portal-AAAA-MM-DD_HHMMSS.db` em `PASTA_BACKUP` (cópia consistente, com o portal rodando) e apaga os mais antigos que `BACKUP_MANTER_DIAS`.
- Agende diariamente (Agendador de Tarefas do Windows ou cron) e leve a pasta de backups (que inclui `midia/`), `PASTA_MIDIA` e `DOCUMENTOS_PASTA` para o backup da empresa.
- **Teste a restauração** pelo menos uma vez, num ambiente de teste.

## Ambiente de teste com dados reais
Para testar uma atualização com dados parecidos com os de produção, copie um backup para o banco do teste (`BANCO` do teste). Mantenha o envio de e-mails e as integrações reais desligados nesse ambiente.

## Fora do escopo deste documento (depende da TI)
**Checklist completo, com responsável e data: [pendências da TI](pendencias-ti.md).** Resumo: Servidor, nome interno, certificado HTTPS, quem opera o backup, conta de serviço que roda o Node, e o serviço Zimbra/OAuth (`zimbra-mcp`) em produção, com o endereço de retorno real cadastrado no Google e na Microsoft.

## Publicação automática pela plataforma (srv-007, template `app-template`)
O repositório segue o template da infra: `app.yml`, `Dockerfile`, `docker-compose.yml` e `.github/workflows/deploy.yml`. Publica-se por **push**: `develop` → homologação (`https://portal-hml.apps.dipaula.com.br`); tag `vX.Y.Z` → produção (`https://portal.apps.dipaula.com.br`), só com a homologação rodando o mesmo commit.

- **Imagem:** compila o site e serve tudo pelo Fastify na porta 3100 (healthcheck `/api/saude`). Dados persistentes no volume `portal_dados` (`/dados`: banco, mídia, documentos, backups).
- **Secrets do repositório** (Settings › Secrets and variables › Actions): `HML_ENV` e `PROD_ENV`, com o conteúdo do `.env` de cada ambiente (senhas diferentes). Variáveis lidas pelo compose:
  - obrigatória: `ORIGENS_PERMITIDAS` (endereço público com https, ex.: `https://portal-hml.apps.dipaula.com.br`);
  - primeiro acesso (sem terminal): `ADMIN_LOGIN`, `ADMIN_SENHA` (8+ caracteres) e `ADMIN_NOME` criam o administrador **só se o banco estiver sem usuários**; ele troca a senha no primeiro acesso, e depois as variáveis devem ser removidas do secret;
  - opcionais: `WEBAUTHN_RP_ID` (biometria), `PERMITIR_DADOS_EXEMPLO=1` (só homologação), `ZIMBRA_API_URL`/`ZIMBRA_API_TOKEN` (o serviço Zimbra roda fora desta stack).
- **Pedir à infra:** liberar o deploy automático (runner) e quem pode publicar em produção.
- Depois: `npm run marca:logo` não roda no contêiner; a logo oficial deve ser instalada pelo painel (Configurações › Empresa) ou pelo terminal quando houver acesso.
- Não validado: a imagem **não foi construída aqui** (sem Docker nesta máquina); o primeiro push em `develop` é o teste.

### Modo debug (ver o erro na tela)
Com `MODO_DEBUG=1` no `.env` do ambiente (secret `HML_ENV` ou `.env` local), uma falha 500 passa a mostrar na tela a mensagem, a rota e as primeiras linhas da pilha (e no console do navegador, prefixo `[debug]`); o servidor também registra o erro no log do contêiner. É **ignorado quando `APP_ENV=prod`**, então não vaza detalhes em produção. Use só em homologação/testes e desligue depois. Erros fora de requisições (`unhandledRejection`/`uncaughtException`) sempre vão para o log.

### Recuperar o administrador sem terminal
No `.env` do ambiente (secret), `ADMIN_REDEFINIR=1` junto com `ADMIN_LOGIN` e `ADMIN_SENHA` (8+) faz o próximo deploy **redefinir** a senha desse administrador (perfil admin, conta ativa, troca obrigatória no primeiro acesso, sessões dele encerradas; auditado como `admin_redefinido_env`). Se o login não existir, ele é criado. **Depois de entrar, remova `ADMIN_REDEFINIR` e `ADMIN_SENHA` do secret**, senão toda subida repete a redefinição.

### Login pelo Keycloak (SSO)
Botão "Entrar com login corporativo" na tela de entrada (OpenID Connect, código + PKCE; módulo `modulos/keycloak`). O login local continua valendo (reserva do administrador).
- **Variáveis no secret** (`HML_ENV` / `PROD_ENV`): `KEYCLOAK_ISSUER_URL` (ex.: `https://auth.dipaula.com.br/realms/dipaula-corp`; ou, alternativa, `KEYCLOAK_URL` + `KEYCLOAK_REALM`), `KEYCLOAK_CLIENT_ID` (ex.: `portal-intranet-hml`), `KEYCLOAK_CLIENT_SECRET`. Opcional `KEYCLOAK_REDIRECT_URI`. Sem emissor, client e secret, o botão não aparece. **Nunca** coloque o secret do cliente no Git nem em conversa.
- **Retorno:** `https://<portal>/api/v1/admin/auth/callback` (o endereço que a TI cadastrou; `/api/v1/auth/callback` também responde, para o campo "Admin URL").
- **Primeiro acesso por SSO:** coloque `ADMIN_EMAIL=<e-mail corporativo>` junto de `ADMIN_LOGIN`/`ADMIN_SENHA` (e `ADMIN_REDEFINIR=1` se o administrador já existir): o e-mail fica gravado e o botão do Keycloak já funciona, sem entrar antes com a senha local.
- **Quem entra:** qualquer pessoa do realm. Se o e-mail do Keycloak já está no cadastro do portal, entra nesse usuário (se ativo). Se **não** está, o usuário é **criado na hora** com o perfil **Consulta** (só leitura; `KEYCLOAK_PERFIL_PADRAO` troca, nunca para admin), sem senha local; nome e login vêm do Keycloak. O administrador **vincula depois, à mão**, os perfis de quem precisa de mais acesso (Configurações › Usuários); o perfil dado à mão nunca é sobrescrito pelo login. E-mail repetido no cadastro ou não verificado é recusado; `KEYCLOAK_CRIAR_USUARIOS=0` volta a exigir cadastro prévio. Auditoria: `login_sso`, `usuario_criado_sso`, `sso_recusado`, `sso_falhou`.
- **Limite:** "Sair" encerra só a sessão do portal (não a do Keycloak).
