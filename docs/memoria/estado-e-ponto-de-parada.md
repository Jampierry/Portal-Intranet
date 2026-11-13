# Estado e ponto de parada

## Sessão de 12/11/2026 — aprovação por aba e anexos nas redes sociais (ENVIADO em ab06507; main = ab06507)
- **Aprovação do RH por aba** (migração 043): a marca única "precisa de aprovação" do usuário saiu. Agora é a permissão `pub.<aba>.aprovacao` (comunicados, redes, banners, documentos) no perfil ou no ajuste do usuário; admin nunca precisa (`exigeAprovacao(usuario, aba)` em `modulos/aprovacoes/api`). Comunicado vai a rascunho; banner fica inativo; documento fica oculto (`documentos.publicado = 0`, também no download); rede vai à fila. Fila aceita tipos `banner` e `documento` (tabela `aprovacoes` recriada). Quem tinha a marca antiga ficou com comunicados + redes. Sub-abas de Aprovações com o estilo `abas-gestao`.
- **Anexos nas redes sociais** (migração 044, `publicacoes_anexos`): PDF, Word, Excel, PowerPoint, OpenDocument, imagens, SVG (`svgSeguro`), TXT, CSV; conteúdo conferido por assinatura; 15 MB, até 10. Envio solto (`POST /api/gestao/redes/anexos?nome=`) e vínculo ao salvar (`vincular`); solto some em 1 dia; download `/api/redes/anexos/:id` (quem vê Redes/Aprovações; solto só o autor). UI: `web/src/gestao/Anexos.tsx` (cartões com miniatura, rolagem só na área dos anexos). Formulário: Título e Link lado a lado, legenda 4 linhas.
- Depois: "Abrir" nos cartões de aprovação (leitura da publicação, `DetalhePedido.tsx`); "Mudar a data" em comunicados, banners, documentos (nova coluna `exibir_de`, migração 045) e redes, voltando para a aprovação de quem precisa (`MudarData.tsx`); aviso de confirmação de leitura sai do sino na hora (evento `leitura-confirmada`). 143 testes.
- Resultado das pesquisas: o RH já decide tudo (liberar por pesquisa, textos, só vencedora, pop-up uma vez); falta só conferir no navegador.
- 141 testes, typecheck e build OK; telas NÃO conferidas no navegador.
- **Próximo:** conferir no navegador (Aprovações, Redes com anexos, permissões por aba, resultado de pesquisa); perfil Marketing precisa de "Ver/Criar/Editar" em Redes sociais (era só permissão, não defeito); avaliar anexos em outras abas e o atalho "tudo" marcar `.aprovacao` (ideal ignorar).
- **Pendências:** `web/imagens/` fora do Git (perguntar); usuários `colegaNN.demo`; security-review; busca duplicada no celular, Início cortado, Feirão Outlet repetido, aba "Dados de exemplo" em produção; Zimbra real; HTTPS (PWA/push).

## Sessão de 11/11/2026 (noite, parte 2) — pesquisas: editor, pop-up em passos e resultado (enviado em `03cb0c6`)
- **Editor** (`PulsoPerguntas.tsx`): lista de perguntas em coluna única; o número da pergunta é botão que **minimiza** o cartão (fica título, ↑↓, Remover); opções em cartões horizontais (foto à esquerda, descrição ao lado). Rolagem é do **corpo da janela** (`.janela-extra .janela-corpo`), não da lista: `fieldset` não repassa altura em flex, por isso o editor é `div` com `fieldset` `display: contents` por dentro.
- **Pop-up** (`PulsoCard.tsx`): uma pergunta por vez, bolinhas numeradas (verde ✓ nas passadas, clicáveis), Voltar/Próxima/Enviar, opções com foto ao lado do texto e sem caixinha, **fogos** ao enviar (CSS puro; ignora "reduzir animações" de propósito).
- **Resultado** (`Pulso.tsx`): janela extra, resumo em faixa, **3 cartões por linha**, barras (texto numa linha com reticências; notas em linha única), listas com altura máxima e rolagem interna; **prévia com dados fictícios** quando faltam 5 respostas.
- **Dados de exemplo** (`modulos/demonstracao/api/pacote.ts`): pesquisas encerradas "Festa de final de ano (exemplo)" (anônima, 28 respostas, 4 tipos) e "Clima da equipe (exemplo, identificada)" (12) + 30 usuários `colegaNN.demo` (sem senha utilizável). Ligar com `npm run demo`.
- 123 testes, typecheck e build OK. Telas conferidas pelo usuário por captura durante os ajustes.
- **Próximo:** o RH **liberar o resultado aos colaboradores** no portal. Decidir: quem vê (todos ou só quem respondeu), se comentários/textos aparecem, onde acessar (Início, sino ou aba), liberação por pesquisa. Possível: exportar resultado.
- **Pendências:** `web/imagens/` (3 JPEGs) fora do Git, perguntar o que fazer; 30 usuários de exemplo poluem a lista de Usuários; security-review; busca duplicada no celular, Início cortado, Feirão Outlet repetido, aba "Dados de exemplo" em produção; Zimbra real; HTTPS para o PWA.

## Sessão de 11/11/2026 (noite) — pesquisas com várias perguntas
- Publicar › **Pesquisas** (antes "Pesquisa de pulso"): título + explicação + **várias perguntas**; cada uma escolhe o tipo (nota 1–5, escolha única, múltipla escolha, texto), obrigatória ou não, **imagem na pergunta e em cada opção**, ordem (↑↓). Várias pesquisas abertas ao mesmo tempo; pop-up mostra a mais recente ainda não respondida. Anônimo, resultado só com 5+ respostas, com barras por opção. Perguntas travam após a 1ª resposta.
- Migração 031 (`pulso_perguntas`, `pulso_respostas_item`; antigas viram 1 pergunta de nota). Código: `modulos/pulso/api`, `web/src/gestao/Pulso.tsx`, `PulsoPerguntas.tsx`, `web/src/inicio/PulsoCard.tsx`; `Crud` ganhou campo `tipo: 'custom'`. 122 testes/typecheck/build OK; telas NÃO conferidas no navegador.
- **Pesquisa identificada** (migração 032, `pulsos.anonima`, `pulso_respostas_item.usuario_id`): o RH escolhe ao criar "Anônima" (padrão) ou "Identificada" (guarda quem respondeu, mostra nomes por opção, sem mínimo de 5; quem responde é avisado; não troca depois da 1ª resposta).
- **Layout do formulário:** janela extra larga (`Crud` ganhou `larga`, `feminino`, `gradeClasse`, `Campo.classe/linhas`); cabeçalho em grade (título/tipo/situação à esquerda, explicação à direita); perguntas em cartões compactos, opções em grade com foto; **rolagem só na lista de perguntas** (`.pq-lista`, `portal.css` fim).
- 123 testes, typecheck e build OK. Falta: conferir no navegador (editor, rolagem, pop-up com fotos, resultado); possível: exportar resultado. **Nada enviado** (só o gatilho "enviar" sobe).

## Sessão de 11/11/2026 (tarde) — avisos próprios e calendário do menu
**Feito (122 testes, typecheck e build OK; telas não conferidas no navegador):**
- **Pop-up próprio** no lugar de `confirm`/`prompt` do navegador: `web/src/Confirmar.tsx` (`confirmar({titulo, mensagem, confirmar, perigo})` → Promise<boolean>, `avisar(...)`, `<ConfirmarHost/>` montado em `main.tsx`). Usado em todas as exclusões e confirmações (Crud, origens, perfis, datas, contas de e-mail, Zimbra, dados de exemplo, pedido de autorização em `api.ts`). **Regra: nunca usar `window.confirm/alert/prompt`; use `confirmar`/`avisar`.**
- Calendário do menu: só resta o botão "+ Data importante" (saíram "Abrir calendário" e o × de excluir; excluir continua no calendário completo e em Configurações › Calendário). Clicar num dia ainda abre o calendário completo.
- `web/imagens/` (3 JPEGs) está fora do Git de propósito (origem desconhecida); confirmar com o usuário.


## Sessão de 11/11/2026 (manhã) — origens de documentos, máscara de telefone, calendário do menu (enviado em `4f4e89a`)
**Feito (122 testes, typecheck e build OK; telas não conferidas no navegador):**
- **Origens de documentos** (migração 030, tabela `documento_origens`, coluna `documentos.origem_id`): o administrador cadastra pastas do servidor/rede em Configurações › **Pastas de documentos** (`OrigensDocumentos.tsx`, janela de tamanho fixo, botão "Procurar…" com seletor de pastas do servidor e campo de pesquisa; rota `/api/gestao/documentos/origens[/navegar]`, só admin). No documento, "Onde está o documento" = Link / Pasta do portal / "Servidor: <origem>" (valor `s<id>` no formulário; no banco `origem='servidor'` + `origem_id`); o arquivo é escolhido por navegador de pastas com **pesquisa** (oculta `~$`); download pelo servidor (`/api/documentos/:slug/arquivo`). Digitar caminho de rede foi removido (docs antigos `rede` aparecem como "antigo"). Botão Abrir corrigido para origem servidor. Origem em uso não pode ser apagada. Servidor do portal precisa de leitura na pasta (TI).
- **Máscara de telefone** (`tipo: 'telefone'` em `Crud.tsx`): celular (começa com 9) `(62) 99999-0000`, fixo `(62) 3333-0000`; aplicada em Contatos › Celular.
- **Calendário do menu em telas baixas (≤800px de altura, ≥861 de largura):** sobe para 10px abaixo de Configurações, mostra os detalhes do dia com rolagem interna; rodapé "Juntos vamos mais longe" no fim (`portal.css`, fim do arquivo).
- Memória do Portal separada da do PREMIA; menções ao PREMIA removidas de `CLAUDE.md`/`docs/memoria`.

**Próximo:** "enviar" (commit + push), conferir no navegador as telas novas (Pastas de documentos, seletor com pesquisa, calendário), depois security-review e pendências visuais (busca duplicada no celular, Início cortado, Feirão Outlet repetido, aba "Dados de exemplo" em produção). Possível: busca recursiva nas subpastas; origens por perfil.

## Sessão de 09/11/2026 — dados de exemplo no banco e ícone do sistema
**Feito:**
- **Imagens no banco** (migração 027, tabela `imagens_arquivo`): uploads, logos e capas ficam no SQLite e valem em qualquer máquina/celular. Arquivos antigos de `dados-privados/imagens` são importados sozinhos na primeira subida. `guardarImagem(db, ...)` agora recebe o banco.
- **Pacote de exemplo** (`modulos/demonstracao`): empresa fictícia **Aurora Esportes** (portal "Aurora Conecta"), com 14 comunicados, 8 documentos, 6 apps (1 restrito), 7 banners, destaques, aniversariantes, novos colaboradores, contatos, calendário, pulso, missão/visão/valores, usuários e todas as imagens (SVG gerados em código). Cada linha criada é anotada em `dados_exemplo`; ligar de novo não duplica; desligar apaga só o anotado e devolve a empresa/entrada de antes (se ninguém editou depois).
- **Ligar/desligar:** Configurações › **Dados de exemplo** (só administrador). `npm run banco:seed` (admin + exemplo) e `npm run demo` ligam; `npm run demo -- desligar` desliga. Em produção os usuários de exemplo ficam sem senha utilizável. Logins: editor/editor123, leitor/leitor123, ana.demo/bruno.demo/carla.demo (demo12345). Substitui o antigo `web/public/demo`, `scripts/gerar-imagens-demo.mjs` e os módulos `*/data`.
- **Ícone do sistema:** arco de portal com rede de pontos (`web/public/icone.svg`; PNG 192/512 por `scripts/gerar-icones.ps1`).
- Testes: 115 passam (`modulos/demonstracao/tests`).

**Pendências:** conferir no navegador (Início, Comunicados, tela de entrada com o carrossel e a logo Aurora, aba Dados de exemplo); no celular o service worker pode guardar o ícone antigo até reinstalar o app.

## Sessão de 08/11/2026 (tarde) — propriedade do conteúdo e layout fixo (enviado; `main` = `1ecb3cb`)
**Feito:**
- **Propriedade do conteúdo** (migração 026, `modulos/propriedade`): só o administrador apaga o que outra pessoa publicou; editar exige pedido autorizado pelo dono **ou** pelo administrador (vale 24 h; chega no sino de ambos: `/api/pedidos-edicao`, `/caixa`, `/:id/decidir`). Conteúdo sem dono registrado (anterior à regra) só o administrador mexe. Conteúdo novo com editar/apagar: acrescentar em `RECURSOS`. Testes em `modulos/propriedade/tests`.
- **Layout (computador, ≥861px):** a janela não rola; topo, abas e rodapé fixos; rolagem só dentro da tela (`.coluna-tela > .conteudo`). Tabelas: cabeçalho fixo até a borda, barra de rolagem abaixo do cabeçalho (`--cab-h`) e abaixo das abas (`--abas-h`), medidos em `App.tsx`; todas ordenam clicando no título. Abas com aparência de aba. Explicações viraram o ícone "!" (`web/src/Dica.tsx`, `DicaAba`). Comunicados: grade 6×3, só a lista rola; tela de entrada em duas colunas; barras de rolagem finas (6px) em tudo.
- Tela de entrada: imagem preenche o lado esquerdo; card da marca no topo da lateral de Comunicados.

**Pendências:** (1) conferir todo o layout no navegador (só compilou e passou nos testes; ajuste fino possível: altura da grade 6×3, faixa do cabeçalho das tabelas, ícone "!"); (2) teste antigo `banners › leitor vê só banners ativos…` falha por data/fuso (já falhava antes; item "Vencido"); (3) a barra de rolagem abaixo do cabeçalho/abas usa pseudo-elementos `::-webkit-scrollbar` (Chrome/Edge); no Firefox ocupa a altura toda; (4) conteúdo antigo sem dono: decidir se o administrador atribui autores.

## Sessão de 08/11/2026 (tudo enviado ao GitHub; `main`)
**Repositórios:** o Portal é `Jampierry/Portal-Intranet` (esta pasta, branch `main`); o app de comissão é outro repositório (`comissao-di-paula`, branch `f05-dashboard-novo`). Não misturar: conferir `git remote -v` antes de commitar. Banco novo: rodar `npm run banco:migrar` (migrações 019 a 024 abaixo). Testes: `npm test` (106), `npm run typecheck`, `npm run build`.

**Feito nesta sessão (todos com teste):**
- **Configurações em abas por assunto:** Empresa (ícone, logo clara e escura em PNG/JPG/WebP/GIF/**SVG** sem script, nomes, slogan, rodapé, fundação) · Tela de entrada (com prévia do login) · **Comunicados** (rótulo/frases do destaque e do painel) · Calendário (feriados) · Integrações · Auditoria. Logo no menu escolhida pela cor do menu (`data-menu`), não pelo tema.
- **Estilos novos GitHub e Notion** (menu claro no tema claro, escuro no escuro); calendário do menu e quadradinho do dia/hora no menu recolhido.
- **Início:** cartão "Pessoas do mês" (aniversariantes, **tempo de casa**, novos colaboradores) e faixa de **aniversário da empresa** (contagem regressiva). RH cadastra em **Publicar › Aniversariantes / Novos colaboradores** (importação de planilha CSV; só aparece com "Autorizou divulgar", LGPD; aniversário guarda só dia e mês). Migrações 019 e 023.
- **Aplicativos restritos por perfil + extras por usuário** (migração 020): Configurações › Perfis libera por perfil; Usuários › Aplicativos soma extras; a pessoa vê a soma; admin vê tudo.
- **Aviso de comunicado por e-mail** (migração 021): e-mail por usuário (opcional) + opção de desligar em "Minha conta"; Integrações liga/desliga, "só urgentes" e endereço do portal; envia pelo serviço Zimbra (`/api/notificar`), uma vez por comunicado.
- **Confirmação de leitura** (migração 022): comunicado marca "Exigir confirmação"; botão "Li e estou ciente"; pendências no sino e em Avisos importantes; relatório "Leituras" (quem leu e quem falta).
- **Pesquisa de pulso anônima** (migração 024): Publicar › Pesquisa de pulso; uma aberta por vez; resposta sem usuário nem hora; resultado só com 5+ respostas.
- **PWA:** `web/public/manifest.webmanifest`, `sw.js` (nunca guarda `/api`), ícones 192/512, registro só em produção. Instalar: abrir o site publicado (HTTPS) no celular › "Adicionar à tela inicial".
- Calendário em tela sem rolagem da página (só o painel de eventos rola, barra fina), calendário e painel na cor do menu, carrossel da entrada animado, banners do celular em carrossel único, abas do lançador (Todos os apps primeiro).

- **Menu da conta:** o avatar na barra superior abre um menu igual ao de aparência (dados, avatar, avisos por e-mail, trocar senha, **instalar o portal** quando o navegador permitir e ícone de **sair do sistema**); a janela "Minha conta" foi removida. **Perfil RH** pronto (migração 025, código `p-rh`).

**Próximos passos / pendências:** (1) conferir tudo no navegador depois de publicar (várias telas foram validadas só por captura de teste e testes automáticos); (2) cadastrar e-mails dos usuários e ligar os avisos em Integrações (precisa do serviço Zimbra conectado); (3) criar o perfil "RH" em Configurações › Perfis com as abas Aniversariantes, Novos colaboradores e Pesquisa de pulso; (4) PWA: precisa de HTTPS no servidor de produção; notificações *push* de verdade (Web Push) ficam como melhoria futura; (5) ideias que sobraram: recuperação de senha por e-mail (agora há e-mail por usuário), SSO, anexos de documentos.


## Portal genérico (08/11/2026)
- Nada de nome de empresa fixo: Configurações › **Empresa** (`cfg.empresa.*`, tabela `portal_config`, módulo `modulos/marca`) guarda nome, nome do portal, slogan, ícone, frases, rótulo/frase do destaque e feriados municipais; Configurações › **Tela de entrada** (`cfg.entrada.*`) guarda o fundo do login (cor, imagem, carrossel) e textos.
- Leitura pública (`/api/empresa`, `/api/entrada`, `/api/publico/imagens/:nome`); instalações com usuários ganham os textos da Di Paula pela migração 017, instalações novas nascem neutras ("Sua Empresa").
- O id interno do estilo de cor `dipaula` foi mantido (só o nome exibido virou "Padrão"), para não perder a escolha salva dos usuários.


**Atualizado em:** 2026-11-07 (tudo enviado ao GitHub; `main` = `357ac4b`)

## Calendário completo, aplicativos por usuário e título na barra superior (2026-11-07, não commitado)
- **Título da tela na barra superior universal**, antes do "Bem-vindo(a)" (`TITULOS` em `App.tsx`); o corpo da página não repete o nome (`Cabecalho` só leva as ações; `interno` mantém o título em páginas de detalhe/erro).
- **Calendário** (migração `015`): tela cheia `web/src/CalendarioPagina.tsx` (menu Calendário, `ver.calendario`), feriados/facultativos/eventos locais (`calendario_datas`) + várias agendas do Zimbra (`zimbra.agendas_exibir`, cada uma com cor), filtros por camada (guardados no navegador), lista do dia e próximas datas. **Por que o Zimbra não aparecia:** só lia UMA agenda e só se a agenda estivesse escolhida; sem Zimbra conectado, nada aparecia. Agora datas locais valem sempre e as agendas são escolhidas em Configurações › Calendário. O mini-calendário do menu também mostra as datas locais.
- **Configurações › Calendário** (permissões `calendario.criar/excluir/agendas` (bloco Calendário em Telas; a aba aparece para quem tem qualquer uma)): CRUD de datas (anual ou única), botão *Gerar feriados do ano* (nacionais, Goiânia, facultativos; `modulos/calendario/api/feriados.ts`) e escolha das agendas do Zimbra. API: `/api/gestao/calendario/{datas,feriados,agendas}`; `GET /api/calendario` agora devolve `datas` e `eventos[].agenda`.
- **Aplicativos por usuário:** `aplicacoes.restrita` (checkbox em Publicar › Aplicativos) + `usuarios_aplicativos`; Configurações › Usuários › **Aplicativos** (permissão `cfg.usuarios.aplicativos`) libera cada pessoa. `/api/aplicacoes` e favoritos só devolvem o que a pessoa vê (admin vê tudo); tirar a liberação remove o favorito.
- `docs/comparativo-mercado.md` (pesquisa e ideias). Testes: `npm test` com 84 (1 falha antiga e não relacionada: "leitor vê só banners ativos…", depende da data de hoje). Typecheck e build ok. **Falta:** conferir por screenshot as telas novas (Calendário, Configurações › Calendário, janela Aplicativos) e testar com o serviço Zimbra real; revisar o teste de banners; commit/push (gatilho *enviar*).

## Onde estamos
- Portal Intranet Di Paula na stack: `web/` (Vite + React), `servidor/` (Fastify + SQLite), `infra/migracoes` (001 base, 002 portal, 003 acessos), `modulos/<nome>/{api,tests,data}`.
- **Login local** criado pelo admin master (perfis `admin`, `editor`, `consulta`), portal fechado, auditoria, bloqueio por tentativas, troca obrigatória da senha provisória.
- **Telas:** Início, Comunicados (lista + detalhe), Documentos, Pessoas (contatos por área), Ajuda (FAQ) e **Gestão** (abas: Comunicados, Documentos, Pessoas em destaque, Contatos, Aplicativos, Usuários, Auditoria). Aplicativos ficam na barra da direita e em Gestão › Aplicativos (sem item no menu esquerdo).
- **Visual:** estilo de tema **Di Paula** (padrão) + 5 estilos antigos, claro/escuro, modo compacto, barra superior universal com aviso da tela, Capa em cor no lugar de fotos.
- **Verificação:** `npm run typecheck` (web + servidor), `npm run build` e `npm test` (41 testes: API com banco em memória, contraste dos temas, regra de links) passam.

## Dados e imagens de demonstração (2026-11-07)
- `npm run demo` = gera imagens (`scripts/gerar-imagens-demo.mjs` → `web/public/demo/`, 12 capas e 12 avatares em SVG, abstratos, sem pessoas reais) + migra + seed + `servidor/src/cli/demo.ts` (13 comunicados em vários estados, 7 documentos, 5 destaques novos, usuários `ana.demo` (editor), `bruno.demo` e `carla.demo` (consulta), senha `demo12345`, contatos extras). Pode repetir sem duplicar; não roda em produção.
- Migração `004-imagens.sql`: `comunicados.imagem`. Campo "Imagem de capa" na Gestão; destaques usam `foto_aprovada` (exposta como `foto`).
- Falta conferir por screenshot as telas com as imagens.

## Ajustes de 2026-11-07 (tarde)
- Campo **Categoria** da Gestão virou seletor com "＋ Nova categoria…" (`Crud.tsx`, `SeletorComNova`), sem o popup nativo do `datalist`.
- **Imagem de capa**: botão "Escolher imagem…" (arquivo do computador ou de pasta da rede), com prévia e "Remover". Módulo novo `modulos/imagens` (`POST /api/gestao/imagens` para admin/editor, `GET /api/imagens/:nome` com login); só PNG/JPG/WebP/GIF até 5 MB, conferido pelos primeiros bytes (SVG recusado de propósito); arquivos em `dados-privados/imagens` (ou `PASTA_IMAGENS`). Campo removido de Documentos (a API não usa).
- Início: o bloco **Documentos recentes** termina na mesma linha dos Comunicados (`contain: size` na coluna da direita) e rola por dentro com barra fina; no celular/tablet volta ao normal.
- `MCP/` (zimbra-mcp, com token) entrou no `.gitignore`.
- Testes: 43. Conferência por screenshot (Playwright-core em pasta temporária + Edge): Início ok; demais telas e celular geradas, falta revisar.

## Menu reorganizado (2026-11-07)
- **Publicar** (editor/admin): Comunicados, Documentos, Colaboradores Destaque (antes "Pessoas em destaque", renomeado também no Início e na Ajuda), Contatos, Aplicativos. **Configurações** (só admin; antes "Gestão"): Usuários, Perfis, Auditoria. Menu: Publicar após Documentos; Configurações no fim.
- Aba **Perfis** é informativa (3 perfis fixos). Falta, se quiser, perfis editáveis.

## Ícone do aplicativo (2026-11-07)
- Migração `005-logo-aplicacao.sql`: `aplicacoes.logo` (endereço `/api/imagens/<nome>`). Cadastro (Publicar › Aplicativos › Cadastro): ao informar o endereço, o portal busca sozinho o favicon (`POST /api/gestao/aplicacoes/icone`, `modulos/aplicacoes/api/favicon.ts`: lê as tags `link rel=icon`, prefere apple-touch/PNG, ignora SVG, cai em `/favicon.ico`); botões "Buscar do aplicativo", "Escolher imagem…" e "Remover". Sem imagem vale o ícone padrão.
- Exibição: `web/src/aplicacoes/IconeApp.tsx` (barra da direita, catálogo); se a imagem falhar cai no ícone padrão. `imagens` agora aceita `.ico` e expõe `guardarImagem`.
- Limite: sistema que exige login ou certificado inválido pode não entregar o favicon (usar envio manual). Só admin chama; busca com limite de 6 s e 512 KB. Testes: 47.

## Banners, missão/visão/valores e colaborador destaque (2026-11-07)
- **Banners** (migração 006, `modulos/banners`): carrossel "Novidades da semana" no topo do Início; cadastro em Publicar › Banners (imagem, título, subtítulo, botão/link interno `#comunicados/slug` ou https, ordem, janela de datas). Sem banner ativo, aparece a faixa padrão. Gira a cada 6,5 s, pausa com mouse/foco/botão, respeita "reduzir movimento".
- **Missão, visão e valores** (migração 007, `modulos/institucional`): editável em Publicar › Missão, Visão e Valores (valores = um por linha, até 8). Aparece no Início à esquerda; some se tudo estiver vazio. Textos do demo são de exemplo: **trocar pelo texto oficial**.
- **Colaborador Destaque** (singular: é o título do reconhecimento e o bloco mostra 3 pessoas por vez, em páginas que deslizam com animação, giro automático de 7,2 s, setas, pontos e pausa): bloco compacto alinhado à direita, ao lado de missão/visão/valores. Renomeado no Início, Publicar e Ajuda.
- Início continua cabendo na altura da janela (testado de 1366×650 a 1920×950). Testes: 52.

## Topo do Início com 3 carrosséis (2026-11-07)
- Migração 008: `banners.posicao` (`principal` = grande à esquerda; `lateral1` e `lateral2` = os dois menores à direita). Em Publicar › Banners cada banner escolhe o carrossel; a ordem vale dentro dele. Giram juntos (um só relógio de 6,5 s); setas/pontos deslocam só aquele carrossel; um botão de pausa. Carrossel grande vazio = faixa padrão; sem laterais, o grande ocupa tudo; no celular só o grande aparece.
- Missão, visão e valores voltou a mostrar tudo junto (sem abas nem rolagem interna): se houver muitos valores o bloco cresce e a página rola. Abaixo de 1500 px de largura, missão e visão ficam uma sob a outra.
- Testes: 53.

## Como retomar
1. `git pull`, `npm install`, `npm run banco:migrar`, `npm run banco:seed`, `npm run dev` (site http://localhost:5174, API 3100).
2. Entrar com `admin / admin123` (editor: `editor / editor123`; consulta: `leitor / leitor123`) — só desenvolvimento, criados pelo seed.
3. Produção: `npm run admin:criar -- <login> "<Nome>"`, `NODE_ENV=production` e `ORIGENS_PERMITIDAS=<endereço público>`. Nunca usar as senhas de exemplo.

## Atenção
- Dados 100% fictícios (seed); canais de contato usam domínio `.invalid`. Trocar pelos reais pela Gestão antes de usar.
- Gestão no celular: as tabelas viram cartões com rótulo (atributo `data-rotulo` + CSS no fim do bloco de 860px de `portal.css`). Falta conferir por screenshot no celular real/emulado, e também Pessoas e Ajuda; e abrir por screenshot os formulários de cada aba da Gestão (o fluxo está coberto pelos testes de API, não por teste de interface).
- Sem fotos reais: `Capa.tsx` aceita `foto` quando houver imagens aprovadas.
- Detalhe do Windows: usar a ferramenta de escrita (ou script Python em arquivo) para editar arquivos grandes; heredocs com aspas quebram no shell.

## Próximos passos (ideias, em ordem sugerida)
1. ✅ Tabelas da Gestão viram cartões no celular (falta só conferir por screenshot).
2. Recuperação de senha por e-mail (exige guardar e-mail) ou SSO, se a TI oferecer.
3. Notificações de novos comunicados e confirmação de leitura de comunicados obrigatórios.
4. Anexos de documentos (com limite de tamanho e antivírus) ou manter só link oficial.
5. Teste de interface automático (Playwright) nas telas principais e nos 6 estilos.
6. Ver também `docs/melhorias-futuras.md` e `docs/roteiro-modulos.md`.

# Histórico (do mais antigo ao mais novo)
## Redesign visual (2026-11-06)
- Layout das imagens de `docs/origem-manus/design/` aplicado sobre os temas existentes (nenhuma cor nova): menu escuro com marca e "Aplicações web", topo claro com busca/tema/sino/avatar, Início (saudação, faixa "Novidades da semana", pessoas em destaque, comunicados, aplicações favoritas), Comunicados (destaque + grade + painel "Temas"), Aplicações e Documentos em cartões, abas fixas no celular.
- Trazido de outro projeto: avatares (galeria de 16 + iniciais) e janela "Meu perfil", cartão de usuário no menu, submenus flutuantes com hover no menu recolhido, sino com avisos (comunicados urgentes), pular para o conteúdo.
- Barra lateral direita de aplicativos recriada (`web/src/aplicacoes/Lancador.tsx`): recolhida = ícones dos favoritos com dica; aberta = abas Favoritos / Todos os apps com estrela; no celular vira gaveta pelo botão de apps do topo. As favoritas também aparecem no menu e no Início.
- Tela inicial vem do endereço (`#comunicados`, `#aplicacoes`, `#documentos`); Voltar do navegador funciona.
- CSS novo em `web/src/portal.css`; tokens de tema continuam em `estilo.css` (o teste de contraste lê só ele).
- Estilo novo **Di Paula** (`data-estilo=dipaula`, agora o padrão): menu carvão, fundo creme, ameixa de destaque, coral nos botões de chamada (coral um pouco mais escuro que o da imagem para passar no contraste). Tokens em `estilo.css`; passa no teste de contraste (claro e escuro). Conferido por screenshot no claro e no escuro.
- Modo compacto (bloco "Modo compacto" no fim de `portal.css`): fonte base 13px, menu 216px com rótulo "ESPAÇO DE TRABALHO", busca de 36px com selo ENTER, cartões/botões/abas/barra de aplicativos menores, comunicados do Início em linha (capa + texto). Referência: protótipo compacto anterior + telas de `docs/origem-manus/design`.
- Barra superior universal: levemente escurecida (tom do destaque; adaptada ao escuro), "Bem-vindo(a), nome" à esquerda, aviso da tela no meio (mapa `AVISOS` em `App.tsx`; os avisos saíram do corpo das telas), versão, busca à direita e ícones pequenos. Perfil saiu do menu lateral: fica só no avatar do topo.
- **Sem fotos**: capas são blocos de cor do tema (`web/src/Capa.tsx`, aceita `foto` quando houver URL).
- Verificado por screenshot (escuro): Início, Comunicados, celular. Conferido por screenshot: 6 estilos × claro/escuro (Início), menu recolhido (corrigido: só ícones), celular (Aplicações), Documentos, detalhe de comunicado.

## Módulos 4 e 5 (2026-11-06)
- Comunicados: detalhe pronto. API `GET /api/comunicados/:slug` (404 para rascunho/arquivado), tela com corpo em parágrafos e "Mais em <categoria>", endereço `#comunicados/<slug>` (os cartões são links; Voltar do navegador funciona).
- Documentos: versão, responsável e data de revisão (dados de exemplo no seed, só onde estavam vazios).
- Testes novos da API em `modulos/comunicados/tests/api.test.ts` (banco em memória); `npm test` agora roda também `modulos/*/tests`.
- Seed: roda de novo sem duplicar; preenche `corpo` e metadados só onde são nulos.

## Login e gestão (2026-11-06)
- **Login local**: admin master cria os usuários (Gestão › Usuários). Perfis `admin` / `editor` / `consulta`. Portal fechado: toda `/api` exige sessão (cookie httpOnly 12 h), exceto `/api/saude` e `/api/login`. Detalhes em `modulos/acessos/README.md`.
- Senha provisória + troca obrigatória no primeiro acesso; bloqueio após 5 falhas em 15 min; auditoria só de inclusão (Gestão › Auditoria); defesa de origem (`ORIGENS_PERMITIDAS`).
- **Gestão** (`web/src/gestao/`): comunicados (rascunho/publicado/arquivado, janela de exibição), documentos (link oficial, versão, responsável, classificação restrita), pessoas em destaque (exige consentimento), aplicações (admin), usuários e auditoria (admin). Abas por endereço: `#gestao/usuarios` etc.
- Início: a coluna da direita agora tem **Avisos importantes** (comunicados urgentes; some se não houver) e **Documentos recentes** (4 mais recentes por data de revisão). A coluna da direita acompanha a altura da esquerda (último cartão cresce até o mesmo limite). A seção "Aplicações favoritas" saiu (menu e barra de aplicativos já cobrem).
- Favoritos agora ficam no servidor, por usuário. Avatar escolhido fica no navegador, por login. Migração `003-acessos.sql`.
- Dev: `npm run banco:seed` cria admin/admin123, editor/editor123, leitor/leitor123. Produção: `npm run admin:criar -- <login> "<Nome>"`.
- Testes: 38 (API com banco em memória + contraste + links). `npm run typecheck` agora checa web e servidor.

## Pessoas e Ajuda (2026-11-07)
- **Pessoas** = contatos por área (`modulos/pessoas`, tabela `contatos`/`departamentos`): canal da área, sem dados pessoais. Gestão em Gestão › Contatos. Seed cria contatos de exemplo (domínio `.invalid`).
- **Ajuda** = perguntas frequentes em `web/src/ajuda/Ajuda.tsx` (texto fixo no código; se virar conteúdo editável, mover para o banco).
- Menu: Pessoas e Ajuda deixaram de ser "em breve".

## Aplicativos (2026-11-07)
- Saíram do menu esquerdo: a seção "Aplicações web" e o item "Aplicações". Os aplicativos agora ficam na **barra da direita** (favoritos e todos) e em **Gestão › Aplicativos** (catálogo para editor/admin; cadastro só admin). No celular, a aba "Aplicativos" do rodapé abre a barra. Endereço antigo `#aplicacoes` volta ao Início.


## Permissões por perfil e por usuário (+ foto e período do Colaborador Destaque)
- Catálogo em `modulos/acessos/api/permissoes.ts`: `ver.*` (comunicados, documentos, pessoas, ajuda) e `pub.*` (comunicados, banners, institucional, documentos, destaques, contatos, aplicativos). Configurações (usuários, perfis, auditoria) continua só do administrador.
- Migração 009: tabela `perfis_permissoes` (editor/consulta, editável) e `usuarios.permissoes` (JSON `{chave: true|false}`). Admin sempre tem tudo.
- Regra: ajuste do usuário (permitir/negar) vale por cima do perfil; sem ajuste, vale o perfil. Calculado a cada requisição (`usuarioDaSessao`), então mudanças valem na hora.
- API: `GET /api/perfis`, `PUT /api/perfis/:codigo`; usuários aceitam `permissoes` (POST/PUT) e devolvem `efetivas`. Rotas usam `exigirPerm('pub.x')`; leituras de comunicados/documentos/contatos exigem `ver.x`; documentos "restritos" aparecem para quem tem `pub.documentos`.
- Tela: Configurações › Perfis (matriz com caixas de seleção) e Usuários › Editar › "Permissões desta pessoa" (Seguir o perfil / Permitir / Negar). Menu, telas, abas de Publicar e blocos do Início respeitam as permissões.
- Colaborador Destaque: campo "Foto da pessoa" em Publicar (usa `foto_aprovada`) e selo do período (mês/ano) sobre a foto no Início.
- Testes: `modulos/acessos/tests/permissoes.test.ts`.

## Colaborador Destaque por mês e ano
- Migração 010: `destaques.mes` e `destaques.ano` (aproveita o rótulo antigo). Publicar › Colaborador Destaque agora pede **Mês** e **Ano** (não há mais "Mês/Ano" como tipo).
- Início: aba **Mês** = destaques do mês vigente (sem selo de período); aba **Ano** = todos os do ano atual, com selo "Mês/Ano" sobre a foto. Data vigente = a do navegador.
- Campo "Foto da pessoa" no cadastro (`foto_aprovada`). Testes em `modulos/inicio/tests/api.test.ts`.

## Calendário de datas importantes (menu) ligado ao zimbra-mcp
- Módulo `modulos/calendario/api`: `GET /api/calendario?mes=AAAA-MM` (login obrigatório) chama `GET /api/eventos` do serviço `MCP/zimbra-mcp` **pelo servidor** (token nunca vai ao navegador), com cache de 5 min; devolve só id/título/início/fim/dia_inteiro/local (sem organizador).
- Configuração (variáveis de ambiente do servidor do portal): `ZIMBRA_API_URL` (ex.: http://127.0.0.1:8765), `ZIMBRA_API_TOKEN` (o mesmo `ZIMBRA_API_TOKEN` do zimbra-mcp) e, opcional, `ZIMBRA_AGENDA` (filtra a agenda por nome). Sem elas, o calendário aparece com o aviso "Agenda ainda não conectada ao Zimbra".
- No zimbra-mcp: ligar o serviço **Agenda** e escolher a(s) agenda(s) da empresa; liberar o IP do portal em `ZIMBRA_API_IPS`. A agenda lida é a da conta de serviço (calendário da empresa, não o pessoal de cada usuário).
- Tela: `web/src/Calendario.tsx` no menu lateral (some com o menu recolhido e em janelas com menos de 780 px de altura). Dia com ponto = há data importante; clicar mostra a lista do dia.
- Testes: `modulos/calendario/tests/api.test.ts` (Zimbra simulado). Ainda não testado com o serviço real.

## Abas liberadas por perfil e por usuário
- Novas permissões `cfg.usuarios`, `cfg.perfis`, `cfg.auditoria` (abas de Configurações) além de `pub.*` (abas de Publicar; a aba Aplicativos agora também depende de `pub.aplicativos`). Padrão: só o administrador tem `cfg.*`.
- Quem não é administrador: não vê administradores, não cria/edita/redefine senha de admin, não edita o próprio cadastro e só concede permissões que ele mesmo tem (usuário e perfil) — sem escalar privilégio. Testes em `modulos/acessos/tests/permissoes.test.ts`.
- Não são abas de tela e ficam fora: Favoritos/Todos (barra de aplicativos) e Mês/Ano (Colaborador Destaque).

## Perfis personalizados e permissões por ação (tela e aba)
- Migrações 011 (perfis com nome; Administrador/Editor/Consulta = `sistema`) e 012 (chaves novas por ação; reseta os padrões de Editor/Consulta e limpa ajustes antigos de usuário).
- Chaves: `ver.<tela>` (+ `documentos.abrir`, `documentos.restritos`), `pub.<aba>.{ver,criar,editar,excluir}` (institucional: ver/editar), `cfg.usuarios.{ver,criar,editar,senha}`, `cfg.perfis.{ver,criar,editar,excluir}`, `cfg.auditoria.ver`. A primeira ação da área ("ver") é o portão: sem ela as outras não valem (`normalizar`).
- API de perfis: `GET/POST /api/perfis`, `PUT/DELETE /api/perfis/:codigo` (perfil do sistema não apaga nem renomeia; em uso não apaga). Não-admin só concede o que tem e nunca mexe em admin.
- Tela: Configurações › Perfis = lista (nome, código, resumo, nº de usuários) com Novo/Editar/Apagar; cada perfil tem grade por tela/aba com as ações. Usuários › Editar usa a mesma grade (ajustes só do usuário).
- Publicar: abas e botões Novo/Editar/Apagar seguem as ações (`PermissoesCtx` em `Crud.tsx`). Documentos sem `documentos.abrir` não recebem o link do servidor.
- Carrosséis do topo agora se chamam Esquerda (maior), Meio e Direita em Publicar › Banners.
- Calendário no menu: sempre visível (compacto em janela baixa), acima do lema do rodapé.
- Tabelas (Usuários, Perfis, Auditoria e todas as de Publicar): clicar no cabeçalho ordena (A→Z, Z→A, original). Hook `useOrdenacao` em `web/src/gestao/Ordenar.tsx`; `Coluna.ordem` opcional no Crud.
- Publicar › Aplicativos: botão alterna entre Catálogo (cartões) e Lista (tabela); lembra a escolha neste navegador. Criar/Editar/Excluir continuam travados por pub.aplicativos.criar/editar/excluir.
- Banners › Link do botão: seleção com pesquisa (comunicados + páginas do portal) ou endereço externo (`CampoLink.tsx`, tipo `link` no Crud). Grava #comunicados/<slug>.

## Ponto de parada (07/11/2026) e próximos passos
- Estado: tudo commitado e enviado ao GitHub (`main`). 71 testes passam; `npm run build` ok. Dev: `npm run dev` (site 5174, API 3100); logins admin/admin123, editor/editor123, leitor/leitor123.
- Últimos ajustes: campo "Link do botão" (CampoLink) alinhado aos outros campos e com menu que abre para baixo/para cima conforme o espaço, já considerando o zoom da página (`--zoom`).
- **Calendário (menu) ainda não testado com o Zimbra real**: definir `ZIMBRA_API_URL` e `ZIMBRA_API_TOKEN` no servidor do portal, ligar o serviço Agenda no zimbra-mcp e liberar o IP em `ZIMBRA_API_IPS`.
- Dúvidas em aberto com o usuário: deixar opcional ou remover a "Referência do consentimento" (LGPD) do Colaborador Destaque; controlar também as abas Favoritos/Todos e Mês/Ano por permissão; trocar o texto de exemplo de Missão/Visão/Valores pelo oficial; ícone do app "Meu RH" (buscar do app ou subir manualmente).
- Lembretes: a configuração "reduzir animações" do Windows do usuário está ligada; os carrosséis (topo e Colaborador Destaque) ignoram essa configuração de propósito. Migrações vão até a 012 (rodam sozinhas ao subir o servidor). Pasta `MCP/` fica fora do Git (tem credenciais).

## Integração Zimbra na tela, busca global e mapa do sistema (07/11/2026)
- Configurações › Integrações (Zimbra): conexão (endereço + token do serviço, agenda da empresa), conta do Zimbra, serviços ligados, agendas usadas, testar. Módulo `modulos/integracoes`; conexão em `integracoes` (migração 013); o portal repassa a configuração ao serviço `MCP/zimbra-mcp` (que só aceita do próprio servidor).
- Calendário: exige agenda escolhida (privacidade); datas criadas/excluídas pelo portal (`calendario.criar/excluir`); menu respeita `ver.calendario`.
- Busca global no topo (`BuscaGlobal.tsx`). Ícones no lugar de nomes no alternador Catálogo/Lista.
- Serviço Zimbra iniciado e conectado ao portal; serviço Agenda ligado. **Pendente do usuário:** escolher a agenda da empresa em Configurações › Integrações.
- Mapa completo: `mapa-do-sistema.md`. 78 testes passam.

## Contatos com ramal e celular (07/11/2026)
- Migração 014: `contatos.ramal` e `contatos.celular` (opcionais, corporativos). Canal (e-mail/link) deixou de ser obrigatório: basta informar canal, ramal ou celular.
- Publicar › Contatos ganhou os campos e as colunas Ramal e Celular; a tela Pessoas mostra "Ramal 2400" e o celular como link `tel:`. Validação no servidor (ramal só números; celular com DDD). 79 testes passam.

## Sessão de 12/11/2026 (tarde) — fechamento do Meu perfil (NÃO enviado)
- Foto de perfil (migração 047, `POST/DELETE /api/eu/foto`, `Avatar` aceita `foto`); ficha de contato/emergência para admin ou quem tiver `cfg.usuarios.emergencia` (`GET /api/usuarios/:id/ficha`, botão "Contato" em Configurações › Usuários, auditada). RH NÃO ganha isso sozinho (teste garante que RH não vê usuários): dar "Ver a aba" + emergência em Perfis.
- Aba "Dados de exemplo" some em produção (sem exemplo ligado nem liberação); celular: telas com busca própria escondem a busca do topo. Security-review do diff e `npm audit`: sem achados. 147 testes, typecheck e build OK.
- Resultado das pesquisas aos colaboradores: já estava pronto. "Feirão Outlet repetido" é dado do banco dev (não está no código). "Início cortado" não reproduzido sem navegador. Telas novas não conferidas visualmente.
- Esclarecido pelo usuário (12/11): "Feirão Outlet repetido" NÃO é defeito — o compromisso se repete em vários dias na agenda. Tela de entrada: altura corrigida com `--zoom` e cartão de vidro. Resta só a parte da TI.
- Também nesta sessão: janela "Contato" redesenhada (cartões, telefones clicáveis, um só botão Fechar) e bloco Avatar de Meu perfil alinhado. Ponto de parada salvo; **nada enviado ainda** (falta "enviar"). Pendente só: TI (servidor, HTTPS, nome interno, backup, leitura nas pastas, firewall 5174) e conferir as telas novas no navegador.

## Sessão de 12/11/2026 (noite) — documentação e revisão (NÃO enviado)
- Enviado antes: `b91d31b` (foto, ficha de emergência, login vitrificado). **Não enviado:** barra inferior padronizada (`portal.css`) e toda a documentação nova.
- Criado: `docs/README.md` (índice), `arquitetura.md`, `referencia-api.md`, `banco-de-dados.md`, `permissoes-e-perfis.md`, `manuais/` (colaborador, publicação, RH, administrador) e `revisao-do-sistema-2026-11-12.md` (melhorias e o que falta). Atualizados: mapa-do-sistema, modulos-status, melhorias-futuras, roteiro-modulos.
- Usuário conferiu no navegador: ficha de Contato, Avatar, login vitrificado e barra inferior. "Início cortado" e a mancha alaranjada deixam de ser pendência.
- **Próximos (ordem sugerida):** TI (servidor, HTTPS, backup, pastas, Zimbra) → segurança (limite de login por IP — explicado ao usuário, aguardando "pode implementar" —, CSP/HSTS, política de senha) → reescrever a tela Ajuda e publicar os manuais no portal → LGPD/marca → ESLint/CI/testes de tela e dividir o CSS → exportar pesquisas, senha por e-mail, 2FA/SSO.

## 2026-11-12 (noite) — endurecimento e qualidade
- Login limitado por login+IP, IP e login; CSP/HSTS em produção; política de senha; Ajuda reescrita; exportar pesquisa em CSV; ESLint + CI; `portal.css` virou `web/src/css/parte-01…09.css` (mecânico, cascata idêntica); `GET /api/gestao/armazenamento`.
- Pendente (terceiros/decisão): TI, marca/LGPD, recuperação por e-mail, 2FA/SSO, antivírus, Playwright, imagens fora do SQLite, consolidar CSS com teste visual. Lista completa em `docs/revisao-do-sistema-2026-11-12.md` (seção 0).

## Ponto de parada — 12/11/2026 (fim da noite)
- **Feito nesta sessão (tudo em commits locais, 9 à frente de `origin/main`; usuário ainda NÃO disse "enviar"):** segurança (login por login+IP/IP/login, CSP+HSTS, política de senha), exportar pesquisa em CSV, ESLint + CI, `portal.css` → `web/src/css/parte-01…10.css` (mecânico; `parte-10` = Ajuda), `GET /api/gestao/armazenamento`.
- **Ajuda:** reescrita; duas abas (Perguntas frequentes / Manuais do sistema, subtítulo muda por aba); coluna central de até 960 px; no computador a página não rola, só o cartão (perguntas, lista de manuais, texto do manual). Manuais vêm de `docs/manuais/*.md` via `modulos/ajuda` (`GET /api/ajuda/manuais[/:id]`), filtrados por prefixo de permissão (`pub.`, `cfg.`).
- **Docs novos:** `docs/pendencias-ti.md` (checklist de 21 itens para a TI) e `docs/melhorias-futuras.md` reorganizado.
- **Verificação:** lint 0 erros, typecheck, build e 153 testes OK. As telas novas da Ajuda NÃO foram vistas no navegador por mim; o usuário vem conferindo por screenshot.
- **Próximo:** (1) manuais por perfil (ex.: Marketing) — aguardando o usuário listar os perfis; (2) `enviar` (push); (3) 2FA TOTP; (4) Playwright; (5) imagens fora do SQLite. Dependem de terceiros: TI, LGPD/marca, e-mail, SSO, antivírus.

## 12/11/2026 (madrugada) — repositório da organização e vidro
- Enviado ao repositório da organização (`Di-Paula-Moda-Esportiva/Portal-Intranet`, conta `jampierry-silva`) um commit único limpo (branch local `org-main`, remoto `org`): sem `origem-manus`, `web/imagens`, CLAUDE.md nem memória. O trabalho segue na `main` (remoto `origin` pessoal) até a TI liberar a homologação; para atualizar a organização, levar as mudanças da `main` para a `org-main` sem os arquivos do Claude.
- Efeito vidro no sistema: `web/src/css/parte-11.css` (janelas, menus/painéis flutuantes, dicas, barra superior e abas no celular). Falta conferir no navegador. Ideia anotada: vídeo em banners e tela de entrada.

## Ponto de parada — 12/11/2026 (madrugada)
- **Organização:** repositório `Di-Paula-Moda-Esportiva/Portal-Intranet` recebeu 1 commit limpo (branch local `org-main`, remoto `org`, conta GitHub `jampierry-silva` logada no Git Credential Manager). Trabalho continua na `main` (`origin` pessoal) até a TI liberar a homologação. Para atualizar a organização: levar mudanças da `main` à `org-main` sem CLAUDE.md, `.claude/`, `docs/memoria/` (já no `.gitignore` da `org-main`) e enviar `git push org org-main:main`.
- **Vidro:** `web/src/css/parte-11.css` = fundo ambiente (manchas vinho/coral) + cartões, janelas, menus, dicas e barras do celular em vidro; override sólido para `prefers-reduced-transparency`. Lição: nunca usar `@media not (feature-nova)` (navegador que não conhece descarta o bloco). Falta o usuário conferir nos 6 estilos × claro/escuro; ajuste fino: `opacity` das manchas, `78%/66%` dos cartões.
- **Melhorias anotadas:** vídeo nos banners e na tela de entrada (em `docs/melhorias-futuras.md`).
- Commits locais da `main` ainda NÃO enviados ao `origin` (d35adbf, e07bc93, 8ada11d, 58c7fd0 e este). Lint, typecheck, build e 153 testes OK.
- **Próximo:** conferir o vidro no navegador; manuais por perfil (usuário lista os perfis); "enviar"; 2FA TOTP; Playwright; vídeo nos banners; resposta da TI (homologação).

## Ponto de parada — 12/11/2026 (fim da madrugada) — vídeo e entrada
- **Vídeo nos banners e no fundo da tela de entrada** (migração 048, `videos_arquivo`): MP4/WebM até **40 MB** (conteúdo conferido por assinatura), no SQLite, entrega por Range (`enviarVideo` em `modulos/imagens/api`). Banners: `POST /api/gestao/videos` (`pub.banners.criar|editar`), `GET /api/videos/:nome` (login). Entrada: `POST /api/gestao/entrada/videos` (`cfg.entrada.editar`), `GET /api/publico/videos/:nome` (só se estiver em uso; rota pública liberada em `modulos/acessos`). Front: `web/src/midia.tsx` (`ehVideo`, `VideoFundo`; só toca o slide/imagem visível), campo `video: true` em `Campo` (Crud). Testes: `modulos/imagens/tests/video.test.ts`. TI: proxy precisa aceitar corpo de ~45 MB (anotado em `docs/implantacao.md`). Banco e backup crescem com vídeos; mover mídia para fora do SQLite continua nas melhorias futuras.
- **Visual:** prévia "Como vai aparecer" (Empresa) não estoura mais o cartão; divisa da tela de entrada (computador) com faixa de desfoque estreita em `.entrar::after` (`parte-11.css`, ajustar `calc(50% + 6px)`, `44px`, `blur(5px)`).
- **Estado do Git:** `main` com commits locais a partir de 73c0d5d NÃO enviados ao `origin`; a organização (`org-main`) só tem o commit inicial limpo. Lint, typecheck, build e 158 testes OK; nada conferido no navegador por mim.
- **Próximo:** conferir vídeo (banner e entrada) e a divisa no navegador; manuais por perfil; "enviar"; 2FA TOTP; Playwright; mídia fora do SQLite; resposta da TI.

## Ponto de parada — 12/11/2026 (manhã) — menu, entrada e ícone
- **Entrada:** imagem fixa e carrossel têm listas próprias (`fixa` e `imagens` em `cfg.entrada`; configuração antiga é migrada em `lerEntrada`). Divisa imagem/formulário com faixa de desfoque (`.entrar::after`, `parte-11.css`).
- **Menu lateral:** logo e frase centralizadas, **sem ícone**; a logo é o botão que recolhe (`.brandbtn`); recolhido, aparece o ☰ (`.menubtn`) para expandir. Tela de entrada também sem ícone, logo centralizada.
- **Ícone da empresa** (Configurações › Empresa › Trocar ícone) agora vira o **ícone da aba do navegador** (`aplicarIconeDaAba` em `web/src/empresa.tsx`; também `apple-touch-icon` se não for SVG). O ícone do PWA instalado continua fixo (`manifest.webmanifest`); gerar 192/512 no servidor é possibilidade futura.
- **Git:** commits locais da `main` desde `73c0d5d` ainda NÃO enviados ao `origin`; organização (`org-main`) só tem o commit inicial limpo. Lint, typecheck, build e 159 testes OK; visuais não conferidos por mim.
- **Próximo:** conferir no navegador (vídeo, divisa da entrada, menu com logo clicável, favicon); "enviar"; manuais por perfil; 2FA; Playwright; mídia fora do SQLite; ícone do PWA dinâmico.

## Ponto de parada — 12/11/2026 (tarde) — organização atualizada
- **Repositório da Dipaula** (`Di-Paula-Moda-Esportiva/Portal-Intranet`, `main` = `5460494`): recebeu vídeo, vidro, menu, ícone da aba etc. Remoto `org` usa a conta `jampierry-silva`.
- **Roteiro de atualização da organização** (usado hoje): `git checkout org-main` → `git diff <base> main -- . ':!CLAUDE.md' ':!.claude' ':!docs/memoria' > patch` → `git apply --3way --index patch` → `npm run publicar` + `npm test` → commit (autor `jampierry.silva@dipaula.com.br`, pt-BR) → `git push org org-main:main` → `git checkout main`. Para a próxima, a base do diff é o último commit da `main` já enviado à organização: **`8836b4b`**. A `org-main` tem pequenas diferenças propositais (README/docs sem referências ao Claude e ao PREMIA, sem `origem-manus`/`web/imagens`).
- **Pessoal** (`origin/main` = `8836b4b`) e organização estão em dia. Nada pendente de envio.
- **Próximo:** conferir no navegador (vídeo, divisa da entrada, menu clicável, favicon, vidro nos 6 estilos); manuais por perfil (usuário lista os perfis); 2FA TOTP; Playwright; mídia fora do SQLite; ícone do PWA dinâmico; aguardar a TI (homologação).

## Ponto de parada — 13/11/2026 — envio limpo à organização
- **Identidade Git local:** `jampierry-silva` / `jampierry.silva@dipaula.com.br`. `origin` = Jampierry (pessoal, recebe tudo); `org` = Di-Paula-Moda-Esportiva (só limpo). `main` acompanha `origin`; sem `pushDefault` no `org` de propósito.
- **Novo gatilho `enviar org`:** `powershell -File scripts/enviar-org.ps1 -Enviar` (substitui o roteiro manual). Exclui CLAUDE.md, `.claude/`, `docs/memoria/`, `docs/origem-manus/`, `web/imagens/`, `docs/avaliacao-estrutura.md`, `docs/comparativo-mercado.md` e o próprio script. Base do diff = tag local `org-base` (agora `6b226b1`, recriar se clonar em outra máquina). Nunca `git push org main`.
- **Testado:** só o caminho "nada a enviar" (corrigidos recursão da função `Git` e `utf8NoBOM` do PS 5.1). O caminho com mudanças reais (apply 3way na `org-main`, publicar+test, commit, push) ainda não foi exercitado; conferir a saída no primeiro uso. Diferenças propositais da `org-main` (README/docs) podem gerar conflito.
- **Estado:** `origin/main` = `6b226b1`; `org/main` = `5460494`; nada pendente de envio.
- **Próximo:** igual ao ponto anterior (conferir visuais no navegador, manuais por perfil, 2FA TOTP, Playwright, mídia fora do SQLite).

## 13/11/2026 — janela "Select an account" do GitHub
- O Git Credential Manager perguntava a conta toda hora (há `Jampierry` e `jampierry-silva` salvas). Corrigido fixando o usuário no URL dos remotos: `origin` = `https://Jampierry@github.com/Jampierry/Portal-Intranet.git`, `org` = `https://jampierry-silva@github.com/Di-Paula-Moda-Esportiva/Portal-Intranet.git` (idem Memoritrix, `origin` = `Jampierry@`). Repositório novo: configurar o remoto já com `usuario@` no URL.

## Ponto de parada — 13/11/2026 (PWA dinâmico)
- **Manifesto do PWA dinâmico** (`0ce77e5`): `/api/manifest.webmanifest` usa nome e ícone da empresa (`modulos/marca/api`, `web/index.html`, `sw.js`, testes). Resolve a limitação de o app instalado manter o ícone fixo.
- **Git:** `origin/main` = `0ce77e5` (pessoal, em dia, inclui a nota das contas do GitHub). **Organização (`org/main`) = `5460494`: faltam levar** o PWA dinâmico, o script `enviar-org` e demais mudanças desde `8836b4b`; só com o gatilho `enviar org` (`scripts/enviar-org.ps1 -Enviar`).
- **Chat desta janela:** Portal-Intranet (Memoritrix só como pasta adicional).
- **Próximo:** conferir no navegador (vídeo, divisa da entrada, menu clicável, favicon e ícone do app instalado, vidro); manuais por perfil; 2FA TOTP; Playwright; mídia fora do SQLite; aguardar a TI.

## Ponto de parada — 13/11/2026 (escala automática para telas de 19")
- **Problema:** em monitor de 19" (janela útil ~1345×644, escala 100%) o layout "desconfigurava": regras de tela baixa/estreita (`max-height: 800px` etc.) disparavam e mudavam o arranjo (menu espremido, calendário sobre o lema). O usuário quer **o mesmo layout da tela grande (referência 1912×928), só menor**.
- **Solução:** `web/src/escala-auto.ts` (`fatorAuto`, `ajustarConsultasDeMidia`) + `web/src/tema.tsx` (`aplicar` multiplica a escala do usuário pelo fator em `--zoom`, reaplica em `resize`/`load`, marca `data-escala-auto`). Janela ≥ 861 px menor que 1600×860 → fator = min(1, larg/1600, alt/860), mínimo 0.6 (1345×644 → 75%). Os `@media` com `px` de largura/altura são reescritos em tempo de execução (px × fator) em todas as folhas. Celular não muda. Teste: `web/test/escala-auto.test.ts`.
- Também: regra de segurança para menu em ≤720 px de altura no fim de `parte-11.css` (quase nunca dispara agora).
- **Docs atualizados:** `arquitetura.md`, `manuais/manual-colaborador.md`, `web/src/css/LEIA-ME.md`, `modulos-status.md`, `gatilhos.md` (novo: **salvar** também atualiza docs/manuais e envia).
- **Verificação:** lint 0 erros, typecheck e 164 testes OK. **NÃO conferido no navegador de 19"**: o usuário precisa dar F5 e comparar com a captura grande. Ajustes possíveis: `REF_LARGURA`/`REF_ALTURA`/`FATOR_MIN` em `escala-auto.ts` (valores maiores = letras maiores, layout mais apertado).
- **Máquinas:** o usuário programa de duas máquinas; ao retomar na outra, `git pull` + `npm install` + `npm run banco:migrar`. `org/main` continua em `5460494` (falta `enviar org`).
- **Próximo:** conferir a escala automática no 19"; conferir no navegador vídeo/divisa da entrada/menu/favicon/vidro; `enviar org`; manuais por perfil; 2FA TOTP; Playwright; mídia fora do SQLite; aguardar a TI.
