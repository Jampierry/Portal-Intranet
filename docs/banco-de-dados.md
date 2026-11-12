# Banco de dados

SQLite (`node:sqlite`), arquivo `dados-privados/portal.db` (fora do Git; muda com `BANCO`). As migrações ficam em `infra/migracoes/NNN-nome.sql`, rodam sozinhas ao subir o servidor (ou `npm run banco:migrar`) e **só avançam**: voltar atrás é restaurar um backup (ver [implantação](implantacao.md)). Estado em 12/11/2026: **47 migrações**.

## Tabelas por assunto
| Assunto | Tabelas |
|---|---|
| Acesso | `usuarios`, `sessoes`, `tentativas_login`, `perfis_permissoes`, `usuarios_aplicativos`, `perfis_aplicativos`, `pedidos_senha`, `auditoria` |
| Perfil pessoal | `usuarios_perfil` (apelido, celular, e-mail alternativo, 2 contatos de emergência, observação de saúde, foto) |
| Conteúdo | `comunicados`, `comunicado_leituras`, `banners`, `institucional`, `documentos`, `documento_origens`, `destaques`, `periodos_destaque`, `contatos`, `departamentos`, `aplicacoes`, `favoritos`, `publicacoes_externas`, `publicacoes_anexos` |
| Pessoas do mês | `aniversariantes`, `novos_colaboradores` |
| Pesquisas | `pulsos`, `pulso_perguntas`, `pulso_respostas`, `pulso_respostas_item`, `pulso_participacao`, `pulso_rodadas`, `pulso_resultados_vistos` |
| Fluxos | `aprovacoes`, `pedidos_edicao` |
| Avisos | `avisos_lidos`, `push_inscricoes` |
| Calendário | `calendario_datas`, `calendario_eventos_dono` |
| Configuração | `portal_config` (empresa e tela de entrada, JSON por chave), `integracoes` (Zimbra), `imagens_arquivo` (todas as imagens ficam no banco), `dados_exemplo` (rastreia o pacote de demonstração) |

Observações de projeto: imagens e anexos ficam **dentro do banco** (valem em qualquer máquina, mas o arquivo cresce); as pesquisas anônimas não ligam resposta e pessoa (`pulso_participacao` só marca quem já respondeu); a auditoria nunca guarda senhas nem o conteúdo do perfil pessoal.

## Histórico das migrações
| # | O que fez |
|---|---|
| 001 base | usuários, sessões, auditoria |
| 002 portal | conteúdo inicial (comunicados, documentos, destaques, contatos, aplicações) |
| 003 acessos | login local, bloqueio por tentativas, carimbos de edição |
| 004–005 | imagem de capa dos comunicados; ícone do aplicativo |
| 006, 008 | banners e sua posição (3 carrosséis do Início) |
| 007 | missão, visão e valores |
| 009, 011, 012 | permissões por perfil, perfis personalizados, permissões por ação |
| 010 | Colaborador Destaque por mês/ano |
| 013 | integração Zimbra |
| 014 | ramal e celular corporativo nos contatos |
| 015 | calendário local; aplicativos restritos por usuário |
| 016–017 | tela de entrada; dados da empresa atual |
| 018 | "esqueci a senha" (pedidos ao administrador) |
| 019, 023 | aniversariantes e novos colaboradores; tempo de casa |
| 020 | aplicativos restritos por perfil |
| 021 | avisos de comunicado por e-mail |
| 022 | confirmação de leitura de comunicados |
| 024, 031–039, 041 | pesquisas: pulso → várias perguntas, identificada, resultado público/restrito, só vencedora, comentário opcional, período, rodadas, pop-up de resultado |
| 025 | perfil "RH" pronto |
| 026 | propriedade do conteúdo e pedidos de edição |
| 027 | imagens guardadas no banco; pacote de exemplo |
| 028 | diretrizes (propósito) |
| 029–030, 045 | documentos: origem (link, pasta do portal, pasta do servidor), origens cadastradas, data de publicação |
| 038, 040 | avisos push; sino (lidos) |
| 042–044 | aprovações de publicações, aprovação por aba, anexos das redes sociais |
| 046–047 | Meu perfil (contato e emergência) e foto |
