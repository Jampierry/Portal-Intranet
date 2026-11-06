# Plano incremental — Portal Intranet Di Paula

## Objetivo

Construir e refinar o portal web responsivo da Di Paula, módulo a módulo. A base inclui a home, **Aplicações** com o Meu RH, a central **Comunicados**, o catálogo **Documentos** e um lançador global de aplicativos na lateral direita. A exportação é estática e demonstra apenas experiências fictícias; o protótipo não é um ambiente privado e não deve incluir dados pessoais ou documentos corporativos reais sem autenticação e autorização adequadas.

## Requisitos já definidos

- O portal serve a uma confecção de moda fitness/esportiva e deve ter uma aparência coerente com a marca, em computador e celular.
- A página pública informada para o Meu RH é `https://meurh.dipaula.com.br/dashboard`. Ela identifica o serviço como restrito a colaboradores Di Paula e direciona o acesso por conta corporativa.
- O Meu RH será apresentado como aplicação web externa, com indicação de que pode solicitar autenticação corporativa. O protótipo não coleta credenciais, não tenta entrar na área restrita e não presume SSO ou integração.
- No computador, clicar no atalho abre o Meu RH em nova aba. No celular, navega para o Meu RH na mesma aba; o retorno ao portal é feito pelo botão Voltar do navegador. Uma página web não garante fechar a aba nem reabrir o portal automaticamente se a aba ou navegador forem encerrados.
- A home mantém comunicados visíveis e uma área de pessoas em destaque do mês/do ano. Conteúdo e identidades usados nessa etapa são explicitamente fictícios.
- A implementação será gradual: diretório, ajuda, administração, autenticação corporativa, gestão de comunicados e integrações ficam para etapas posteriores. Publicação de conteúdo real fica condicionada a controles de acesso e governança.

## Escopo desta etapa

1. **Home responsiva** com navegação, identificação do portal, campo de busca visual, destaque e lista curta de comunicados demonstrativos, atalhos de aplicações e módulo de reconhecimento.
2. **Carrossel inicial de pessoas em destaque** com alternância entre “Destaque do mês” e “Destaques do ano”, dados fictícios, controles anterior/próximo e pausa/retomada quando houver rotação automática. O movimento deve respeitar `prefers-reduced-motion` e não depender apenas de gestos.
3. **Página Aplicações** com o cartão do Meu RH, categoria Pessoas e RH, resumo, condição de acesso e ação para abrir o serviço externo. Outras categorias podem aparecer identificadas como “Em breve”, sem inventar URLs.
4. **Navegação desktop/celular**: no desktop, menu lateral e abertura externa em outra aba; em telas estreitas, navegação compacta e abertura externa na mesma aba, com instrução de retorno pelo botão Voltar.
5. Os itens de menu para os módulos não entregues ficam marcados como “Em breve” e não fingem ser páginas prontas.
6. **Central de Comunicados (`/comunicados`)** com listagem de avisos fictícios, busca textual e filtros por categoria, navegação a partir do menu, da chamada principal da home e do link “Ver todos”; indicar a quantidade de resultados e oferecer estado vazio com ação para limpar os filtros.
7. **Catálogo Documentos (`/documentos/`)** com busca textual e filtros por categoria no cliente, contagem de resultados e estado vazio acionável. Exibir somente títulos, metadados e formatos de exemplo claramente fictícios; não incorporar nem baixar arquivos reais, e informar que o protótipo não inclui documentos para download.
8. **Lançador global de aplicativos** na lateral direita, presente nas páginas do portal e recolhível no computador; no estado recolhido, mostrar atalhos em ícone para os apps favoritos. Em telas estreitas, abrir como painel sobreposto acionado por botão e permitir fechá-lo pelo botão, pelo fundo ou pela tecla Escape. Incluir as abas “Favoritos” e “Todos os apps”, permitir marcar/desmarcar favoritos e guardar essa preferência somente no `localStorage` deste navegador. Os cards leem o catálogo central `data/applications.ts`; ainda há apenas o Meu RH cadastrado. No desktop, abrir o destino em nova aba; no celular, na mesma aba.
9. **Cabeçalho universal fixo** em todas as rotas, com o nome da tela atual dentro da barra, junto à busca e às ações globais. A barra permanece fixa no topo e atravessa a largura da janela à direita da navegação esquerda. O lançador lateral começa logo abaixo dela, sem cobrir o cabeçalho, tanto no desktop quanto no celular. Abrir ou recolher a lateral direita não pode mover, piscar ou redimensionar o cabeçalho; somente a largura/estado do menu esquerdo pode mudar sua posição horizontal. Não repetir o nome atual da tela no corpo como título ou breadcrumb; manter textos descritivos que não dupliquem o nome.
10. **Navegação lateral esquerda colapsável** no computador, com controle de menu padrão (hambúrguer) no topo da própria barra lateral, ao lado da marca — não no cabeçalho universal. Manter os ícones de navegação visíveis no estado recolhido e nomes acessíveis/tooltip. O controle da lateral direita usa um ícone próprio de grade de aplicativos, visualmente distinto do hambúrguer. A preferência de recolhimento pode ficar salva apenas no navegador atual.

## Fora desta etapa

- Login real, papéis/permissões, persistência de usuários ou gestão de conteúdo.
- Dados verdadeiros de colaboradores, imagens ou reconhecimento real.
- Upload, armazenamento, visualização ou download de documentos internos reais; nenhuma cópia de documento corporativo deve ser incluída na exportação pública.
- CRUD, APIs corporativas, SSO, VPN, integração com folha, ERP ou produção.
- Publicação de dados reais, conteúdo interno ou de uma intranet operacional sem proteção de acesso.

Esta etapa pode publicar apenas uma demonstração estática. Controles de acesso são pré-requisito para disponibilizar dados ou conteúdo interno real.

## Abordagem de implementação

- **Frontend:** Next.js com App Router e TypeScript, em projeto web flexível. A experiência permanece frontend-only, com conjuntos de demonstração tipados e sem chamadas a serviços corporativos. CSS responsivo próprio e tokens reutilizáveis manterão o visual consistente; ícones vetoriais simples terão rótulos acessíveis.
- **Rotas:** `/` para home, `/aplicacoes/` para aplicações, `/comunicados/` para comunicados e `/documentos/` para o novo catálogo; manifesto estático de rotas mantido sincronizado com as páginas implementadas.
- **Abertura externa:** link seguro com `rel="noopener noreferrer"`; em telas desktop o destino será nova aba e em telas estreitas a navegação será interceptada para a mesma aba. A interface informará os dois comportamentos.
- **Acessibilidade:** estrutura semântica, foco visível, navegação por teclado, rótulos para controles e conteúdo, contraste adequado, controles do carrossel e suporte a movimento reduzido.
- **Conteúdo demonstrativo:** avisos rotulados como demonstração; colaboradores fictícios representados por iniciais ou avatares neutros, não por retratos de pessoas reais.
- **Central de comunicados:** controles no frontend filtram os dados demonstrativos tipados por texto e categoria; cada cartão mantém categoria, data, título e resumo. Não há publicação, edição, leitura individual persistida, backend ou conexão com um sistema editorial.
- **Documentos:** dados tipados vivem em arquivo separado; o diretório oferece busca e categorias no cliente, mas cada registro indica formato de exemplo e não tem URL de arquivo, link de download ou conteúdo de documento. A página avisa que títulos e metadados são fictícios e que não há arquivos disponibilizados.
- **Lançador de aplicativos:** `components/application-launcher-sidebar.tsx` apresenta duas listas derivadas do catálogo de aplicações, abas acessíveis, ações de favorito e abertura responsiva dos destinos. No rail desktop recolhido, cada favorito continua acessível por atalho em ícone com rótulo acessível; a preferência de favoritos não é enviada a servidor nem sincronizada entre dispositivos. `PortalShell` controla expansão e fechamento por Escape; CSS reserva a largura da barra no desktop e converte-a em gaveta com fundo clicável no celular.
- **Cabeçalho universal:** `PortalShell` deriva o título atual do item ativo da navegação e o renderiza como o único título principal (`h1`) em todas as páginas, preservando busca e ações globais. Nas rotas de módulos, remover o título atual e o breadcrumb duplicado do corpo, mantendo o resumo/descrição; no Início, manter a chamada editorial como título secundário. O cabeçalho é `position: fixed`, ocupa a janela à direita do menu esquerdo e não depende da largura/estado do lançador direito; seu espaço é compensado no fluxo do conteúdo inferior. O lançador/backdrop começa abaixo do cabeçalho. Somente a largura/estado do menu esquerdo altera sua borda inicial horizontal.
- **Navegação esquerda colapsável:** `PortalShell` guarda o estado compacto no `localStorage` do navegador e liga a largura do rail e a margem do cabeçalho ao espaço do conteúdo. O botão hambúrguer fica no topo da própria barra esquerda, ao lado da marca, e alterna `aria-expanded`; no estado compacto, preservar as rotas por ícone e dica acessível. O ícone 3×3 do lançador direito continua exclusivo para aplicativos.
- **Exportação estática:** Next.js `output: "export"` e `trailingSlash: true` geram os HTMLs em `out/`. Busca de aplicações, comunicados e documentos roda no cliente, sem dependência de `searchParams` dinâmicos nem servidor; o formulário global leva `q` ao catálogo e o componente restaura o termo no navegador.
- **Build de publicação:** `corepack pnpm install --frozen-lockfile && corepack pnpm build`, com `out` como `build.outputDirectory`. Não usar credenciais ou arquivos instalados apenas no Sandbox; os artefatos devem ser reproduzíveis a partir do checkpoint e do lockfile.
- **Serviços:** nenhum banco, servidor de aplicação ou autenticação será provisionado nesta etapa. Antes de inserir dados de uso interno, definir provedor de identidade, autorização e governança com a empresa.

## Direção visual

**Referência provisória:** as telas conceituais desktop e mobile geradas e refinadas anteriormente nesta conversa. Elas sugerem uma estética editorial contemporânea com foco operacional: base clara e arejada, navegação grafite, ameixa/vinho como cor de assinatura provisória e coral para ações, títulos com hierarquia forte e cartões compactos. Essa paleta e o lettering “Di Paula” não são apresentados como identidade oficial; validar logo, cores e fontes com o manual da marca antes de produção.

- **Princípios:** clareza operacional; reconhecimento humano sem competição; presença visual esportiva e refinada; uso equilibrado do espaço de tela.
- **Layout:** no desktop, menu lateral persistente e conteúdo em composição de colunas assimétricas, com comunicados e pessoas visíveis sem rolagem excessiva; no celular, fluxo vertical, áreas de toque amplas e navegação compacta.
- **Elementos de assinatura:** filetes coral em itens ativos/ações; cartões editoriais com pequeno rótulo de categoria; indicadores discretos nos controles de carrossel.
- **Interação e movimento:** estados hover/foco claros e transições curtas; rotação do carrossel lenta, pausável e desativada/reduzida quando solicitado pelo sistema.
- **Tipografia:** sans-serif de alta legibilidade com títulos pesados, texto regular e rótulos pequenos em caixa alta; usar stack de sistema para evitar dependência externa e manter desempenho.
- **Voz:** acolhedora, direta e útil. Exemplos: “Comunicados para acompanhar o que importa.” e “Acesse o Meu RH com sua conta corporativa.”
- **Marca provisória:** wordmark textual exploratório acompanhado de um pequeno símbolo geométrico de movimento; não usar arquivo de logotipo oficial sem fornecimento/aprovação.

## Estrutura prevista do projeto

```text
/home/ubuntu/dpintra/
├── app/
│   ├── layout.tsx                 # layout raiz, metadados e fontes
│   ├── page.tsx                   # home do portal
│   ├── aplicacoes/page.tsx        # catálogo de aplicações
│   ├── comunicados/page.tsx       # central de comunicados
│   ├── documentos/page.tsx        # catálogo de documentos demonstrativos
│   └── globals.css                # tokens, tipografia e responsividade
├── components/
│   ├── portal-shell.tsx           # cabeçalho, navegação e container
│   ├── application-launcher-sidebar.tsx # painel global e favoritos locais
│   ├── application-card.tsx       # atalho externo com comportamento por viewport
│   ├── application-directory.tsx  # busca de catálogo compatível com exportação estática
│   ├── announcement-list.tsx      # lista compartilhada de comunicados demonstrativos
│   ├── announcement-directory.tsx # busca, filtros e resultados da central
│   ├── document-directory.tsx     # busca, filtros e metadados sem arquivos de download
│   └── recognition-carousel.tsx   # destaques fictícios acessíveis
├── data/
│   ├── applications.ts            # metadados do Meu RH e categorias vazias
│   ├── announcements.ts           # conteúdo fictício marcado como demonstração
│   ├── documents.ts               # títulos e metadados fictícios, sem arquivos ou URLs
│   └── recognition.ts             # pessoas fictícias e períodos
├── public/manus-routes.json       # manifesto sincronizado com as páginas
├── package.json                   # comandos e dependências fixadas
├── pnpm-workspace.yaml             # política de scripts de dependências
└── plan.md                         # este plano aprovado e decisões de implementação
```

A estrutura separa rotas, componentes e dados demonstrativos. O protótipo pode ser publicado somente como site estático demonstrativo; publicação e uso de conteúdo real continuam sujeitos a revisão de acesso e segurança.
