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
