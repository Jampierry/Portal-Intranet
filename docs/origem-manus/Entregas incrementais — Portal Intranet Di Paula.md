# Entregas incrementais — Portal Intranet Di Paula

## 1. Home e navegação responsiva
- [x] Construir uma home responsiva para computador e celular, com identidade visual conceitual ligada à Di Paula e sem apresentar a proposta como manual oficial da marca.
- [x] No desktop, usar navegação lateral e aproveitar a área de tela; no celular, reorganizar o conteúdo em fluxo vertical com navegação compacta e controles fáceis de tocar.
- [x] Exibir a identidade do portal, busca de aplicações, atalhos para Início, Comunicados, Aplicações e Documentos; Pessoas e Ajuda ficam claramente marcados como “Em breve”.
- [x] Manter comunicados de demonstração visíveis na home, junto de atalhos de aplicações e da área de Pessoas em destaque.

## 2. Comunicados demonstrativos e reconhecimento
- [x] Exibir comunicados de demonstração com título, resumo, categoria e data, identificados como conteúdo fictício do protótipo.
- [x] Apresentar a seção de reconhecimento com alternância entre “Destaque do mês” e “Destaques do ano”; os nomes, áreas e textos são fictícios, sem fotos ou dados pessoais reais.
- [x] Permitir navegação anterior/próximo e por indicadores; incluir pausa/retomada da rotação automática, navegação por teclado e respeito a `prefers-reduced-motion`, sem criar ranking competitivo.

## 3. Catálogo de aplicações e primeiro atalho Meu RH
- [x] Implementar a página Aplicações com o Meu RH como primeiro item, usando `https://meurh.dipaula.com.br/dashboard`.
- [x] Identificar Meu RH como Pessoas e RH, resumir o serviço, indicar aplicação web externa e avisar que pode solicitar autenticação com conta corporativa.
- [x] Não presumir acesso à área restrita, não coletar nem armazenar credenciais e não afirmar integração ou SSO não confirmados.
- [x] No computador, abrir Meu RH em nova aba; no celular, navegar na mesma aba e orientar o retorno pelo botão Voltar. A interface não promete fechar aba, liberar memória específica ou reabrir automaticamente o portal.
- [x] Não inventar URLs para outras aplicações; os demais destinos não estão ativos nesta etapa.

## 4. Rotas, acessibilidade e limites de segurança
- [x] Manter as rotas `/`, `/aplicacoes/`, `/comunicados/` e `/documentos/` e sincronizar o manifesto estático de rotas.
- [x] Usar estrutura semântica, foco visível, rótulos acessíveis, navegação por teclado, contraste legível e controles acessíveis para busca, navegação e carrossel.
- [x] Nesta etapa, usar conteúdo demonstrativo apenas no frontend, sem banco ou autenticação real; não inserir dados reais de colaboradores ou conteúdo interno confidencial.
- [x] Manter o protótipo sem autenticação e sem conteúdo interno real; qualquer versão estática publicada deve conter somente dados demonstrativos. Definir autenticação, autorização e governança antes de disponibilizar informações reais.

## 5. Central de Comunicados
- [x] Criar a página responsiva `/comunicados` e torná-la acessível pelo item Comunicados na navegação desktop e mobile, pela chamada principal “Ver comunicados” da home e por “Ver todos” na seção de comunicados da home.
- [x] Listar comunicados demonstrativos contendo categoria, data, título e resumo; deixar explícito que os dados são fictícios e não são orientações nem comunicados oficiais.
- [x] Permitir busca textual e filtragem por categoria; mostrar quantidade de resultados e uma mensagem acionável quando nenhum comunicado corresponder, incluindo opção de limpar a busca e os filtros.
- [x] Manter esta etapa somente frontend e sem persistência: não incluir criação, edição, publicação, leitura persistida, dados reais, nem integração com sistemas corporativos.

## 6. Build estático compatível com publicação
- [x] Configurar Next.js para exportação estática com `output: "export"` e caminhos com barra final; gerar HTML para a home e para `/aplicacoes/`, `/comunicados/` e `/documentos/` no diretório `out/`.
- [x] Manter a busca do catálogo funcional no navegador sem depender de `searchParams` renderizados no servidor; o termo `q` enviado pela busca global deve ser lido no cliente.
- [x] Configurar o contrato WebDev com `build.command` igual a `corepack pnpm install --frozen-lockfile && corepack pnpm build` e `build.outputDirectory` igual a `out`.
- [x] Não habilitar servidor, banco ou credenciais para este build; não incluir dados reais ou conteúdo interno da empresa no protótipo publicável.

## 7. Catálogo Documentos demonstrativo
- [x] Criar a página responsiva `/documentos/`, com acesso pela navegação desktop e mobile, mantendo Documentos como item ativo quando a tela estiver aberta.
- [x] Exibir somente títulos, categorias, resumos e formatos de exemplo explicitamente fictícios; incluir um aviso claro de que nenhum documento real está anexado e nenhum download está disponível nesta versão.
- [x] Oferecer busca por título, resumo ou categoria e filtro por categoria; atualizar a contagem de resultados e apresentar estado vazio com ação para limpar busca e filtros.
- [x] Manter todo o módulo no frontend estático, sem upload, armazenamento, leitura ou download de arquivos, sem dados corporativos reais e sem chamadas a serviços externos.

## 8. Lançador global de aplicativos na lateral direita
- [x] Exibir em todas as páginas do portal uma barra lateral do lado direito que concentre os aplicativos cadastrados e que possa ser expandida ou recolhida no computador.
- [x] Em telas estreitas, abrir o painel sobre a página por um botão “Aplicativos” e permitir fechá-lo pelo próprio botão, clicando no fundo escurecido ou pressionando Escape.
- [x] Incluir as opções “Favoritos” e “Todos os apps”; “Todos os apps” deve listar todos os itens ativos do catálogo `data/applications.ts`, começando pelo Meu RH.
- [x] Permitir marcar e desmarcar apps como favoritos; guardar a seleção somente no `localStorage` do navegador atual, sem conta, backend ou sincronização entre dispositivos.
- [x] Em cada lista, abrir o web app em nova aba no computador e na mesma aba no celular, respeitando o comportamento já acordado para o Meu RH.
- [x] Quando a lateral direita estiver recolhida no computador, manter os apps favoritos visíveis como atalhos compactos em ícones; cada atalho deve ter nome acessível e abrir o destino do app.

## 9. Cabeçalho universal e posição da lateral
- [x] Exibir em todas as telas uma barra superior universal com o nome da tela atual dentro dela, mantendo a busca global e as ações já existentes.
- [x] Fazer a barra superior percorrer toda a largura da área de conteúdo até a borda direita; iniciar a lateral de Aplicativos somente abaixo dela, sem sobrepor ou esconder o cabeçalho.
- [x] Em telas móveis, manter visíveis a barra universal e o nome atual da tela; o painel de apps e o fundo que o fecha começam abaixo da barra e não cobrem seus controles.
- [x] Retirar o nome atual da tela do corpo das páginas de módulo e dos breadcrumbs duplicados; preservar textos explicativos e a chamada editorial da home, que não é o nome “Início”.

## 10. Menu lateral esquerdo colapsável e ícones de navegação
- [ ] Permitir recolher/expandir a barra lateral esquerda no computador por um botão no topo da própria barra lateral, usando ícone hambúrguer padrão (não no cabeçalho universal) e atualização coerente de `aria-expanded`/`aria-label`.
- [x] No estado recolhido, preservar os ícones de navegação, o estado da página atual e nomes acessíveis/dicas para que os destinos continuem identificáveis.
- [x] Usar no controle de abertura da lateral direita um ícone de grade de aplicativos, diferente do hambúrguer usado na navegação esquerda.
- [x] Manter a escolha de recolhimento somente neste navegador, se persistida, sem conta ou sincronização entre dispositivos.

## 11. Barra superior fixa e independente do lançador direito
- [ ] Manter a barra superior fixa no topo da janela e fora do fluxo/área que muda de largura quando o painel direito abre ou fecha.
- [ ] Ao abrir ou recolher a barra direita de aplicativos, não mover, piscar, redimensionar ou redesenhar a barra superior; somente o conteúdo abaixo pode reservar/reorganizar espaço para o painel.
- [ ] Permitir que somente o recolhimento/expansão do menu esquerdo altere o início horizontal da barra superior, acompanhando a largura do menu esquerdo.
- [ ] Posicionar o botão hambúrguer no topo da navegação esquerda, ao lado da marca; removê-lo completamente da barra universal.
