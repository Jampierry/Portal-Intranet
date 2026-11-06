# Plano e escopo do portal intranet Di Paula

**Documento de descoberta, requisitos e proposta de protótipo**  
**Data:** 4 de novembro de 2026

## 1. Visão do portal

Criar um portal interno responsivo que reúna aplicações web, comunicados, documentos, pessoas e acessos de uso frequente. O portal deve atender com a mesma qualidade quem trabalha no computador durante o expediente e quem acessa pelo celular ou dispositivo compartilhado.

A Di Paula se apresenta como empresa de moda esportiva que combina qualidade, conforto, tecnologia e informação de moda. Sua página institucional informa que começou em 1997, produz mais de um milhão de peças por ano, atende mais de 3 mil lojas parceiras e beneficia diretamente mais de 400 famílias. A marca declara como propósito “fazer da moda esportiva um meio de vida melhor para todos”. Isso inspira uma intranet prática, humana e ligada às pessoas e aos processos, sem confundir o portal interno com a loja pública. [1]

A página inicial pública tem navegação para Quem Somos, Lojas, Revendedor, Representantes e Atendimento, além de redes sociais e coleções. Ela dá referências de conteúdo e universo da marca, mas não substitui o manual de identidade visual. Validar logo, cores, fontes e fotografia com Marketing antes de fechar o design system. [2]

## 2. Objetivos e princípios

- **Acesso centralizado:** reduzir o tempo procurando links, avisos e documentos em diferentes canais.
- **Comunicados visíveis:** fazer da página inicial uma entrada para avisos atuais, importantes e relevantes por público.
- **Reconhecimento com cuidado:** dar visibilidade a colaboradores destaque do mês e do ano por meio de um carrossel, com critérios claros, consentimento para exposição e moderação editorial.
- **Experiência equivalente:** projetar e testar as telas para computador e celular, não apenas adaptar um layout de um dispositivo para o outro.
- **Fonte confiável:** apresentar responsável, data de atualização e versão de documentos.
- **Acesso adequado:** separar conteúdo geral e conteúdo restrito por função, unidade ou área.
- **Evolução gradual:** começar com links e conteúdo interno; integrar sistemas apenas depois de mapear APIs, responsáveis e permissões.

Para produção e outras equipes de linha de frente, considerar conectividade, tempo curto de acesso e dispersão entre canais. A literatura de comunicação interna recomenda concentrar informação em um ponto acessível por dispositivos móveis, sem excluir a experiência das equipes de escritório. [3]

## 3. Públicos e necessidades

- **Produção e confecção:** comunicados operacionais, segurança, procedimentos, calendário, contatos e links úteis.
- **Lideranças e supervisão:** avisos por equipe ou turno, orientação de rotina e reconhecimento de contribuições.
- **RH e Pessoas:** benefícios, políticas, integração, calendário, contatos e governança das indicações de colaboradores destaque.
- **Design, produto e qualidade:** biblioteca de normas, materiais de referência e procedimentos com versão.
- **Comercial e áreas administrativas:** aplicações corporativas, comunicados relevantes e diretório.
- **Administradores e editores:** publicação, revisão, segmentação, arquivamento, permissões e métricas básicas.

## 4. Escopo do protótipo e MVP

### Incluído

1. **Início:** boas-vindas, busca, comunicados em destaque e recentes, aplicações favoritas, agenda e módulo “Pessoas em destaque”.
2. **Comunicados:** lista, detalhe, filtros por categoria/área/prioridade e identificação de comunicados urgentes.
3. **Aplicações:** catálogo de links com categoria, descrição, público, responsável e favoritos.
4. **Documentos:** categorias, busca, versão, responsável e data de revisão, com links para o repositório oficial.
5. **Pessoas e áreas:** diretório e canais de contato corporativo aprovados para divulgação.
6. **Ajuda:** FAQ e encaminhamento simples de sugestão/solicitação se existir um responsável para triagem.
7. **Administração:** gestão de atalhos e comunicados, rascunho/publicação/arquivamento e administração de conteúdos de reconhecimento.
8. **Carrossel de reconhecimento:** alternância entre “Destaque do mês” e “Destaques do ano”, cards editoriais, navegação manual e controles de animação. No protótipo, usar conteúdo e retratos ilustrativos claramente fictícios.
9. **Responsividade:** layouts próprios para desktop, tablet e celular, com estados de carregamento, erro e conteúdo vazio.

### Fora do primeiro corte

- Substituir ERP, folha, ponto, sistemas de produção, CRM ou solução de RH.
- Armazenar documentos pessoais ou dados sensíveis de folha, saúde e desempenho.
- Chat em tempo real, rede social interna completa, push nativo, sincronização offline ou integrações múltiplas.
- Processos de férias, alteração cadastral, aprovações formais ou avaliação de desempenho sem mapear o sistema e processo oficial.
- Classificação automática de pessoas, ranking público ou pontuação gamificada.

O protótipo deve simular as aplicações externas por links e dados fictícios. Integrações reais dependem de sistemas existentes, APIs/SSO, licenças e autorização dos responsáveis.

Todos os destinos do escopo móvel são aplicações web. No computador, o atalho abre o destino em nova aba e mantém a intranet aberta na aba original. No celular, o atalho navega para o web app na mesma aba; assim, o portal sai da tela e o navegador pode liberar recursos da página anterior. O retorno é feito pelo botão Voltar do navegador, que pode restaurar a página anterior ou carregá-la novamente. A aba não pode ser fechada de forma confiável por código web, e a liberação/restauração exata de memória é decisão do navegador. [8] [9]

## 5. Mapa do portal

```text
Portal Di Paula
├── Início
│   ├── Busca global
│   ├── Comunicados em destaque e recentes
│   ├── Pessoas em destaque
│   │   ├── Destaque do mês
│   │   └── Destaques do ano
│   ├── Aplicações favoritas
│   ├── Agenda / próximas datas
│   └── Acesso rápido a documentos e ajuda
├── Comunicados
│   ├── Todos
│   ├── Por área/categoria/prioridade
│   └── Detalhe
├── Aplicações
│   ├── Todas
│   ├── Pessoas e RH
│   ├── Produção e qualidade
│   ├── Produto e criação
│   ├── Comercial
│   └── Administrativo e financeiro
├── Documentos
│   ├── Políticas e procedimentos
│   ├── Segurança e qualidade
│   └── Materiais internos / versões
├── Pessoas e áreas
├── Ajuda / FAQ / Solicitações
└── Administração (conforme permissão)
    ├── Usuários, papéis e permissões
    ├── Aplicações e categorias
    ├── Comunicados e documentos
    └── Pessoas em destaque e calendário editorial
```

## 6. Direção visual e telas do protótipo

No **desktop**, usar navegação lateral persistente, busca acessível, grade de conteúdo em colunas, comunicados na primeira dobra e módulo de reconhecimento com espaço suficiente para leitura e imagem. No **celular**, usar navegação compacta, cartões em sequência vertical e carrossel horizontal com controles fáceis de tocar. Em ambas as versões, dar destaque claro a “Comunicados” sem transformar reconhecimento em ranking.

A proposta de cores e tipografia dos mockups é conceitual, pois não foi possível confirmar um manual público da marca. Retratos de colaboradores nas telas são imagens ilustrativas, não pessoas reais da Di Paula.

**Telas visuais geradas:** [Home desktop](/home/ubuntu/di-paula-home-desktop.png), [Home mobile](/home/ubuntu/di-paula-home-mobile.png), [Central de comunicados desktop](/home/ubuntu/di-paula-comunicados-desktop.png), [Carrossel de colaboradores destaque](/home/ubuntu/di-paula-carrossel-destaques-desktop.png) e [Aplicação web aberta no celular](/home/ubuntu/di-paula-aplicacoes-mobile-web.png).

## 7. Requisitos funcionais

### RF-01 — Identidade e perfil
Autenticar usuários pelo provedor corporativo escolhido. Apresentar conteúdo por função/área. Contas e seleção de papel em protótipo são somente demonstração; não valem como segurança de produção.

### RF-02 — Página inicial
Exibir comunicados importantes e recentes, aplicações favoritas, busca e pessoas em destaque. No desktop, compor os módulos em colunas; no celular, reorganizar para leitura vertical. Não exigir abrir outra página para ver o comunicado principal.

### RF-03 — Comunicados
Campos mínimos: título, resumo, corpo, categoria, público-alvo, prioridade, autor, período de exibição e imagem opcional. Permitir rascunho, publicação e arquivamento. Exigir confirmação de leitura somente para conteúdos definidos pela política interna.

### RF-04 — Catálogo de aplicações
Cada item possui nome, descrição curta, categoria, URL, público, responsável, visibilidade, ícone e condição de acesso. Identificar claramente links que abrem sistemas externos.

### Abertura de aplicações por dispositivo
No computador, abrir cada sistema externo em nova aba (`target="_blank"`) e manter a aba do portal disponível. Informar visualmente que o link abre em nova aba, conforme a orientação de acessibilidade para mudanças de contexto. [8]

No celular, abrir o web app externo na mesma aba (`target="_self"`, o padrão para links web). O portal deixa de ser a página atual e fica no histórico de navegação; o usuário retorna pelo botão Voltar. Se a empresa controla o web app externo, incluir também um comando visível “Voltar ao Portal Di Paula”. A página do portal pode ser restaurada pelo cache de navegação ou recarregada. A web não consegue garantir fechamento da aba nem liberar uma quantidade específica de memória. [8] [9]

Essa solução não reabre o portal automaticamente quando o usuário fecha uma aba ou encerra o navegador; isso não é controlável de forma confiável por uma página web. O requisito funcional é retorno simples por Voltar, sem deixar duas abas abertas no celular. Cada atalho deve guardar: URL, nome do sistema, modo de abertura para desktop/mobile, responsável, requisitos de login/VPN e caminho de retorno. Mostrar uma mensagem de orientação na primeira abertura ou no catálogo de atalhos.

### RF-05 — Documentos
Mostrar título, categoria, versão, responsável, classificação de acesso e data de vigência/revisão. Preferir apontar ao repositório corporativo oficial em vez de criar cópias sem controle.

### RF-06 — Busca
Pesquisar comunicados, documentos, pessoas e aplicações sem retornar conteúdo que o usuário não está autorizado a ver.

### RF-07 — Carrossel de destaques
Alternar entre “Destaque do mês” e “Destaques do ano”. Permitir navegação por setas, indicadores de posição e toque/arraste em dispositivos compatíveis. A rotação automática, se ativada, deve ser lenta, parar quando houver foco ou interação e oferecer controle visível de pausar/retomar. Respeitar a configuração `prefers-reduced-motion` e manter o conteúdo navegável por teclado e leitor de tela.

Cada card pode conter nome, foto aprovada, área/função, período, breve apresentação ou contribuição e link para uma matéria interna opcional. A empresa precisa definir elegibilidade, método de indicação/seleção, aprovação e data de expiração. Não criar ranking competitivo nem usar métricas de produtividade sem governança aprovada.

### RF-08 — Administração e auditoria
Permitir a editores autorizados gerir aplicações, comunicados e conteúdos de reconhecimento. Registrar quem publicou ou alterou e quando; conservar histórico de alterações relevantes.

### RF-09 — Ajuda
Disponibilizar FAQ e canais de encaminhamento. Solicitações devem coletar somente dados necessários e ter responsável pela resposta.

## 8. Requisitos não funcionais

- **Responsividade:** testar jornadas completas em monitor, tablet e celular. No desktop, aproveitar a área útil sem esticar linhas longas; em celular, controles amplos e navegação compacta.
- **Acessibilidade:** meta de projeto WCAG 2.2 AA, com contraste, foco visível, navegação por teclado, rótulos acessíveis e controle de movimento. WCAG 2.2 define critérios testáveis aplicáveis a diferentes dispositivos. [4]
- **Desempenho:** comprimir imagens, carregar conteúdo principal primeiro e validar em dispositivos/conexões usados na empresa.
- **Segurança:** autenticação e autorização no servidor e no banco, menor privilégio, logs administrativos e segredos fora do código.
- **Privacidade e LGPD:** minimizar dados, explicar finalidades, limitar acesso e retenção e envolver o encarregado/DPO e jurídico antes do uso de dados reais. A ANPD disponibiliza orientação e checklist de segurança da informação. [5]
- **Manutenção:** componentes reutilizáveis, documentação e testes automatizados complementados por verificações manuais.

## 9. Governança de “Pessoas em destaque”

Antes de publicar nomes, fotos ou histórias, RH e Comunicação devem aprovar: critérios e periodicidade; como pessoas são indicadas e selecionadas; quem valida o conteúdo; consentimento e possibilidade de retirar a imagem; canais e duração de publicação; tratamento de colaboradores que não desejam participar; e prevenção de favorecimento ou exposição indevida. Aplicar a mesma política a destaques mensais e anuais.

Conteúdo inicial do protótipo deve usar pessoas e textos fictícios. Para produção, avaliar consentimento/informação e base legal com a área de privacidade; não tratar a participação como obrigatória nem vinculá-la a avaliação de desempenho. Definir prazo de retenção e retirar conteúdo vencido do carrossel.

## 10. Modelo de dados inicial

- `profiles`: identidade, nome, área, unidade e status.
- `roles` / `permissions`: papéis e permissões.
- `apps` e `favorites`: catálogo de aplicações e preferências do usuário.
- `announcements`: conteúdo, categoria, público, prioridade, autor e vigência.
- `documents`: metadados, versão, responsável, link e classificação.
- `departments` / `contacts`: áreas e canais corporativos publicáveis.
- `recognition_periods`: mês/ano, estado editorial, início/fim de exibição.
- `recognition_entries`: pessoa, período, texto de apresentação, área, foto aprovada, status editorial e referência de consentimento conforme política interna.
- `audit_events`: autor, ação, objeto, data e resultado.
- `support_requests`: apenas se aprovado, com dados mínimos e prazo de retenção.

Na opção Supabase, ativar Row Level Security nas tabelas expostas, definir políticas por operação e testar permissões de leitura e escrita. As políticas de linha não substituem os grants de banco. [6]

## 11. Tecnologias recomendadas

- **Aplicação web:** Next.js com App Router e TypeScript para páginas, layouts e lógica de servidor. [7]
- **Interface:** Tailwind CSS e componentes acessíveis (por exemplo, shadcn/ui ou biblioteca interna); definir tokens após aprovação da identidade visual.
- **Dados e autenticação:** Supabase/PostgreSQL/Auth/Storage como opção de protótipo, condicionada à aprovação corporativa, região de hospedagem, contrato, backups e integração de identidade.
- **Formulários e validação:** Zod e React Hook Form ou equivalentes, com validação também no servidor.
- **Busca:** começar com busca textual e filtros; ampliar quando volume e necessidade forem conhecidos.
- **Hospedagem:** selecionar conforme SSO, políticas corporativas, localização de dados, logs, recuperação e custo.
- **Animação do carrossel:** transições CSS leves ou biblioteca acessível, sem dependência de animações pesadas; reduzir movimento conforme preferência do sistema.

Next.js separa autenticação, sessão e autorização e recomenda considerar bibliotecas de autenticação. A escolha deve acompanhar o provedor de identidade e os requisitos de SSO da empresa. [7]

### Integrações a investigar

Provedor de identidade/SSO; RH/folha; ponto; ERP; produção; qualidade; CRM; gestão documental; chamados; canal de avisos; cadastro e desligamento de pessoas. Para cada web app, confirmar URL HTTPS, compatibilidade mobile, autenticação, comportamento no botão Voltar e possibilidade de incluir um link “Voltar ao Portal Di Paula”. No MVP, manter esses sistemas como links externos. Só implementar APIs depois de confirmar responsável, documentação, permissões, suporte e fluxo de login.

### Organização do projeto

Separar rotas/telas, componentes visuais, regras de negócio, integrações, dados e testes em módulos próprios para facilitar manutenção. O mapa de pastas sugerido está em [Arquitetura de pastas do projeto](/home/ubuntu/portal-intranet-di-paula-mapa-pastas.md). O escopo atual é web tanto no computador quanto no celular; não há shell móvel nativo.

## 12. Fases de execução

1. **Descoberta:** entrevistas com RH, TI, Comunicação, Produção, Qualidade e usuários; inventário de aplicações e conteúdos; análise de dispositivos; definição de 5–8 tarefas principais e governança de reconhecimento.
2. **Arquitetura e design:** mapa do portal, wireframes de desktop e celular, identidade visual validada, conteúdo demonstrativo e teste de navegação com usuários.
3. **MVP funcional:** autenticação de teste, home com comunicados e carrossel, central de comunicados, aplicações, documentos e administração mínima.
4. **Piloto:** testar com áreas distintas; avaliar busca, leitura, acessos, conforto em telas maiores e pequenas, acessibilidade do carrossel e entendimento dos critérios de destaque.
5. **Integrações e expansão:** adicionar SSO/APIs e notificações aprovadas, após segurança, privacidade e governança editorial.

## 13. Critérios de aceite

- A home exibe comunicados em destaque no desktop e celular e inclui acesso a comunicados recentes.
- A pessoa encontra e abre uma aplicação/documento por navegação ou busca em ambos os formatos.
- No computador, cada link externo abre em nova aba e a aba do portal permanece disponível.
- No celular, cada link externo abre o web app na mesma aba; Voltar no navegador retorna ao portal sem exigir uma segunda aba. Não se exige liberação de memória em quantidade exata nem reabertura automática após fechar o navegador.
- O carrossel alterna mês/ano; setas e controles funcionam por teclado e toque; movimento pode ser pausado e respeita redução de movimento.
- Conteúdo de demonstração é fictício; nenhum colaborador real aparece antes de aprovação e governança.
- Editor autorizado publica, atualiza e arquiva comunicados e destaques sem alterar código.
- Usuário sem permissão não acessa conteúdo restrito alterando URL ou chamada à API.
- Layout não apresenta rolagem horizontal indevida; controles têm foco visível e contraste revisado.
- Registros de leitura e métricas são limitados ao necessário e têm finalidade definida.

## 14. Perguntas de descoberta

1. Quantos colaboradores, áreas, unidades e turnos utilizarão o portal?
2. Quais tarefas e links são mais usados no computador? E no celular?
3. Qual provedor de identidade existe? Há colaboradores sem e-mail corporativo?
4. Quais comunicados devem aparecer para todos e quais são segmentados?
5. Onde vivem os documentos oficiais, quem mantém as versões e quem aprova procedimentos?
6. Qual manual de marca, logo, fontes e fotografia estão disponíveis?
7. Quais são as regras de indicação e seleção para destaques do mês e do ano? Quem aprova e por quanto tempo o conteúdo fica publicado?
8. Como será obtida autorização para nomes, fotos e histórias? Qual será o canal para retirar a participação?
9. Quais sistemas corporativos e APIs/SSO estão disponíveis?
10. Quais são as exigências de hospedagem, orçamento, segurança, backup e suporte?

## 15. Próximo passo

Realizar uma oficina de descoberta com RH, TI, Comunicação e representantes de Produção. Levar o inventário de ferramentas, identidade visual, estrutura de áreas/turnos, repositório documental e uma proposta de critérios de reconhecimento. Validar primeiro a home desktop e mobile, a leitura de comunicados e a governança do carrossel; usar conteúdo fictício até que privacidade, critérios e consentimento estejam aprovados.

## Referências

[1]: https://dipaula.com.br/sobre "Di Paula Moda Esportiva - Quem Somos"
[2]: https://dipaula.com.br/ "Di Paula Moda Esportiva - Página inicial"
[3]: https://www.workvivo.com/blog/internal-comms-for-frontline-workers-guide/ "Workvivo - Frontline Employee Communications"
[4]: https://www.w3.org/TR/WCAG22/ "W3C - Web Content Accessibility Guidelines 2.2"
[5]: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte "ANPD - Guia de segurança da informação"
[6]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase - Row Level Security"
[7]: https://nextjs.org/docs/app/guides/authentication "Next.js - Authentication"
[8]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a "MDN - Links HTML e destinos _self/_blank"
[9]: https://developer.mozilla.org/en-US/docs/Web/API/Window/close "MDN - Window.close() e restrições do navegador"
