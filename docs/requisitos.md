# Requisitos — Portal Intranet Di Paula

Consolidado a partir de `docs/origem-manus/` (Plano e escopo, Plano incremental, Entregas incrementais, Mapa de pastas). Legenda: ✅ feito no protótipo · 🟡 parcial · ⬜ planejado (produção/futuro).

## 1. Visão e objetivos
Portal interno responsivo que reúne aplicações web, comunicados, documentos, pessoas e acessos de uso frequente, com a mesma qualidade no computador e no celular. Objetivos: acesso centralizado; comunicados visíveis; reconhecimento com cuidado (sem ranking); experiência equivalente em desktop/mobile; fonte confiável (responsável, data, versão); acesso por função/unidade; evolução gradual (links primeiro, integrações depois).

## 2. Públicos
Produção/confecção · lideranças · RH/Pessoas · design/produto/qualidade · comercial/administrativo · administradores/editores.

## 3. Escopo
**Protótipo atual (frontend estático, dados fictícios):** Início, Comunicados, Aplicações (Meu RH), Documentos (catálogo sem arquivos), lançador global de apps, cabeçalho universal, menu esquerdo colapsável, carrossel de destaques.

**Fora do primeiro corte:** substituir ERP/folha/ponto/CRM; documentos pessoais ou dados sensíveis; chat, rede social, push, offline; férias/aprovações/avaliação; ranking ou gamificação; login real, papéis, CRUD, APIs corporativas, SSO/VPN.

## 4. Requisitos funcionais
| ID | Requisito | Módulo | Status |
|---|---|---|---|
| RF-01 | Identidade e perfil (SSO corporativo; papéis). No protótipo, só demonstração | (futuro: auth) | ⬜ |
| RF-02 | Início: comunicados em destaque/recentes, apps favoritos, busca, pessoas em destaque; colunas no desktop e fluxo vertical no celular | inicio | ✅ (página recriada — conferir) |
| RF-03 | Comunicados: título, resumo, corpo, categoria, público, prioridade, autor, vigência, imagem; rascunho/publicação/arquivamento | comunicados | 🟡 lista, busca e filtro ✅; detalhe e gestão ⬜ |
| RF-04 | Catálogo de apps: nome, descrição, categoria, URL, público, responsável, visibilidade, ícone, condição de acesso; destacar link externo | aplicacoes | ✅ (só Meu RH) |
| RF-04b | Abertura por dispositivo: desktop nova aba; celular mesma aba + orientação de retorno | aplicacoes / shell | ✅ |
| RF-05 | Documentos: título, categoria, versão, responsável, classificação, vigência; apontar ao repositório oficial | documentos | 🟡 catálogo fictício ✅; versão/responsável ⬜ |
| RF-06 | Busca global sem vazar conteúdo não autorizado | shell | 🟡 busca de apps/comunicados/documentos ✅; global ⬜ |
| RF-07 | Carrossel mês/ano: setas, indicadores, toque; rotação lenta e pausável; `prefers-reduced-motion`; teclado/leitor de tela | inicio | ✅ |
| RF-08 | Administração e auditoria (quem publicou/alterou e quando) | (futuro: admin) | ⬜ |
| RF-09 | Ajuda/FAQ e solicitações com dados mínimos | (futuro: ajuda) | ⬜ |
| RF-10 | Lançador global de apps na direita: recolhível, favoritos no `localStorage`, gaveta no celular (fecha por botão/fundo/Esc) | aplicacoes + shell | ✅ |
| RF-11 | Cabeçalho universal com nome da tela; sem título duplicado no corpo | shell | ✅ |
| RF-12 | Menu esquerdo colapsável com hambúrguer **no topo da própria barra lateral** (não no cabeçalho) | shell | 🟡 (Entrega 10) |
| RF-13 | Barra superior **fixa**, independente da largura do lançador direito; só o menu esquerdo altera seu início horizontal | shell | 🟡 (Entrega 11) |

## 5. Requisitos não funcionais
- Responsividade: monitor, tablet e celular, sem rolagem horizontal.
- Acessibilidade: WCAG 2.2 AA (contraste, foco, teclado, rótulos, controle de movimento).
- Desempenho: imagens comprimidas, conteúdo principal primeiro.
- Segurança: autenticação e autorização no servidor e no banco, menor privilégio, logs, segredos fora do código.
- Privacidade/LGPD: minimização, finalidade, retenção; DPO e jurídico antes de dados reais.
- Manutenção: componentes reutilizáveis, documentação, testes automatizados + manuais.

## 6. Governança de "Pessoas em destaque"
RH e Comunicação aprovam antes de publicar nomes/fotos: critérios e periodicidade; indicação e seleção; validação do conteúdo; consentimento e retirada; canais e duração; quem não quer participar; prevenção de favorecimento. Conteúdo do protótipo é fictício. Sem vínculo com avaliação de desempenho; definir retenção.

## 7. Modelo de dados inicial (produção)
`profiles` · `roles`/`permissions` · `apps`/`favorites` · `announcements` · `documents` · `departments`/`contacts` · `recognition_periods` · `recognition_entries` (com consentimento) · `audit_events` · `support_requests` (se aprovado). Com Supabase: RLS em todas as tabelas expostas e testes de permissão.

## 8. Critérios de aceite
- Home exibe comunicados em desktop e celular.
- Achar app/documento por navegação ou busca nos dois formatos.
- Desktop abre nova aba e mantém o portal; celular abre na mesma aba e Voltar retorna.
- Carrossel alterna mês/ano com teclado, toque, pausa e movimento reduzido.
- Só conteúdo fictício até governança aprovada.
- (futuro) Editor publica sem alterar código; usuário sem permissão não acessa conteúdo restrito por URL/API.
- Sem rolagem horizontal indevida; foco visível; contraste revisado; métricas limitadas ao necessário.

## 9. Perguntas de descoberta (em aberto)
1. Quantos colaboradores, áreas, unidades e turnos?
2. Tarefas e links mais usados no computador e no celular?
3. Provedor de identidade? Há quem não tenha e-mail corporativo?
4. Quais comunicados são gerais e quais segmentados?
5. Onde vivem os documentos oficiais e quem aprova?
6. Manual de marca, logo, fontes e fotografia disponíveis?
7. Regras de indicação/seleção dos destaques e prazo de publicação?
8. Como obter autorização e retirar participação?
9. Sistemas e APIs/SSO disponíveis?
10. Exigências de hospedagem, orçamento, segurança, backup e suporte?
