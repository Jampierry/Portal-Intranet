# Pendências da TI para colocar o portal em produção

Lista do que **só a TI pode fazer** (infraestrutura, acessos e rede). O código do portal já está pronto para esses pontos; o passo a passo técnico está em [implantação](implantacao.md). Atualizada em 12/11/2026.

Marque cada item ao concluir e anote data e responsável.

## 1. Bloqueiam a ida para produção
| # | Item | O que precisamos | Feito |
|---|---|---|---|
| 1 | **Servidor** | Máquina (Windows ou Linux) com Node 24+ e Git, em rede interna. | ☐ |
| 2 | **Nome interno** | Endereço fixo, por exemplo `portal.suaempresa.com.br`, apontando para o servidor. | ☐ |
| 3 | **HTTPS** | Certificado válido e proxy reverso (IIS, nginx ou Caddy) repassando para o portal em `127.0.0.1` com `X-Forwarded-Proto`. **Sem HTTPS o login não funciona em produção** (cookie `Secure`) e o **push** de notificações também não. O portal só envia o cabeçalho HSTS quando a requisição chega por HTTPS. | ☐ |
| 4 | **Serviço que sobe sozinho** | Conta de serviço dedicada (sem privilégios de administrador) rodando `npm start` na raiz do projeto, com reinício automático (NSSM no Windows; systemd ou PM2 no Linux). | ☐ |
| 5 | **Variáveis de ambiente** | Arquivo `.env` a partir de `.env.example`: `NODE_ENV=production`, `ORIGENS_PERMITIDAS=https://<nome interno>`, `TRUST_PROXY=1`, `HOST=127.0.0.1`, `BANCO`, `DOCUMENTOS_PASTA`, `PASTA_BACKUP`, `BACKUP_MANTER_DIAS`. Sem `ORIGENS_PERMITIDAS` o servidor se recusa a subir. | ☐ |
| 6 | **Primeiro administrador** | Rodar `npm run admin:criar -- <login> "<Nome>"` e entregar a senha provisória ao responsável. **Não rodar o seed** (`banco:seed` é só de desenvolvimento). | ☐ |
| 7 | **Pasta de manuais** | Publicar o projeto **com a pasta `docs/manuais/`**: a Ajuda lê os manuais desse caminho no servidor. | ☐ |

## 2. Backup e continuidade
| # | Item | O que precisamos | Feito |
|---|---|---|---|
| 8 | **Backup agendado** | Agendar `npm run backup` todos os dias (Agendador de Tarefas ou cron). Gera uma cópia consistente do banco com o portal rodando e apaga as mais antigas que `BACKUP_MANTER_DIAS`. | ☐ |
| 9 | **Backup da pasta de documentos** | Incluir `DOCUMENTOS_PASTA` e a pasta de backups no backup da empresa. | ☐ |
| 10 | **Teste de restauração** | Restaurar um backup num ambiente de teste pelo menos uma vez e anotar o resultado. | ☐ |
| 11 | **Armazenamento** | Imagens, vídeos e anexos ficam em arquivos na pasta de mídia (`PASTA_MIDIA`, padrão `midia/` ao lado do banco; o serviço precisa gravar nela e ela entra no backup). Os anexos das redes sociais também ficam nessa pasta (`anexos/`); no banco só há os índices. O portal mostra os tamanhos em `GET /api/gestao/armazenamento` (administrador) e avisa se o banco passar de 1 GB. | ☐ |

## 3. Rede, acessos e integrações
| # | Item | O que precisamos | Feito |
|---|---|---|---|
| 12 | **Leitura nas pastas de rede** | O usuário do serviço (item 4) precisa de permissão de **somente leitura** nas pastas de rede de onde o portal serve documentos. | ☐ |
| 13 | **Firewall** | Liberar só a porta do proxy (443) para a rede interna. A porta 3100 do portal fica fechada para fora (escuta só em `127.0.0.1`). Em desenvolvimento em rede, liberar a 5174 mediante administrador. | ☐ |
| 14 | **Zimbra / OAuth em produção** | Subir o serviço `zimbra-mcp` e cadastrar o **endereço de retorno real** (do nome interno) no Google e na Microsoft. Configurar `ZIMBRA_API_URL`, `ZIMBRA_API_TOKEN` e `ZIMBRA_AGENDA`. Sem isso o e-mail e a agenda reais não funcionam. | ☐ |
| 15 | **Servidor de e-mail (SMTP)** | Conta e servidor para os **avisos por e-mail** e, no futuro, a recuperação de senha por e-mail. | ☐ |

## 4. Segurança e operação
| # | Item | O que precisamos | Feito |
|---|---|---|---|
| 16 | **Monitoramento** | Alerta de queda (o portal responde em `GET /api/saude`), de espaço em disco, de tamanho do banco e de falha do backup. | ☐ |
| 17 | **Logs** | Definir onde os logs do serviço ficam e por quanto tempo (o modo produção grava logs). | ☐ |
| 18 | **Antivírus nos anexos** | Indicar o antivírus corporativo e como integrá-lo (ou varrer a pasta de documentos e os anexos). Hoje há só limite de tipo e de tamanho. | ☐ |
| 19 | **SSO corporativo (opcional)** | Se a empresa tiver Azure AD ou Google, informar os dados do aplicativo para trocar o login local pelo SSO. | ☐ |
| 20 | **Ambiente de teste** | Segundo ambiente com cópia do banco, **sem** envio de e-mail e **sem** integrações reais (ver [implantação](implantacao.md)). | ☐ |
| 21 | **Revisão de segurança** | Teste de invasão ou revisão completa antes de usar dados reais. | ☐ |

## 5. O que NÃO é da TI (para não se perder)
Estas decisões são da empresa e também bloqueiam o uso de dados reais: validar marca, cores e logo com o **Marketing**; definir com o **RH/Jurídico** as regras de **LGPD** (base legal, retenção de respostas, auditoria e fotos; contato de emergência e saúde); definir quem publica e quem aprova. Ver [melhorias futuras](melhorias-futuras.md#decisões-do-negócio).
