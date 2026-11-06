# Mapa de pastas do projeto — Portal Intranet Di Paula

## Premissas de arquitetura

O portal e os sistemas acessados pelo celular são **web apps**. A proposta é um único projeto responsivo com Next.js e TypeScript, testado em desktop e mobile. No desktop, atalhos externos abrem em outra aba; no celular, abrem na mesma aba, preservando o retorno ao portal pelo histórico/botão Voltar do navegador.

Uma página web não pode fechar sua aba de forma confiável nem controlar exatamente quanto de memória o navegador libera. O fluxo na mesma aba remove o portal da tela ao navegar para o sistema externo, e o navegador decide se mantém a página anterior em cache ou a recarrega ao voltar.

Cada tela/domínio deve ficar organizado em módulo próprio, separando rotas, componentes, validações, serviços, tipos e testes, para facilitar manutenção futura.

## Árvore sugerida

```text
di-paula-intranet/
├── src/
│   ├── app/                                  # rotas Next.js e composição de páginas
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (portal)/
│   │   │   ├── layout.tsx                    # shell comum: menu, header e proteção
│   │   │   ├── page.tsx                      # home: comunicados, destaques, atalhos
│   │   │   ├── comunicados/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── aplicacoes/page.tsx
│   │   │   ├── documentos/page.tsx
│   │   │   ├── pessoas/page.tsx
│   │   │   ├── ajuda/page.tsx
│   │   │   └── admin/
│   │   │       ├── page.tsx
│   │   │       ├── aplicacoes/page.tsx
│   │   │       ├── comunicados/page.tsx
│   │   │       └── destaques/page.tsx
│   │   ├── api/                              # endpoints necessários
│   │   ├── globals.css
│   │   └── manifest.ts                       # metadados PWA se usados
│   ├── features/                             # código separado por função
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── server/
│   │   │   ├── schemas.ts
│   │   │   └── types.ts
│   │   ├── home/
│   │   │   ├── components/
│   │   │   └── services/
│   │   ├── announcements/
│   │   │   ├── components/
│   │   │   ├── server/
│   │   │   ├── schemas.ts
│   │   │   └── types.ts
│   │   ├── app-links/                        # catálogo/abertura de web apps
│   │   │   ├── components/
│   │   │   ├── open-application.ts           # escolhe navegação por viewport
│   │   │   ├── link-policy.ts                # regras desktop/mobile
│   │   │   ├── server/
│   │   │   └── types.ts
│   │   ├── documents/
│   │   ├── directory/
│   │   ├── recognition/                      # destaque do mês e do ano
│   │   │   ├── components/
│   │   │   │   └── RecognitionCarousel.tsx
│   │   │   ├── server/
│   │   │   ├── schemas.ts
│   │   │   └── types.ts
│   │   └── support/
│   ├── components/                           # componentes visuais compartilhados
│   │   ├── shell/                            # sidebar, header, menu mobile
│   │   ├── ui/                               # botões, campos, cards
│   │   └── feedback/                         # estados de erro/vazio/carregamento
│   ├── lib/                                  # infraestrutura compartilhada
│   │   ├── supabase/
│   │   ├── security/
│   │   ├── accessibility/
│   │   └── validation/
│   ├── styles/                               # tokens de design e estilos
│   └── test/                                 # configuração de testes do app
├── public/
│   ├── brand/                                # logo/fontes aprovados pela marca
│   ├── icons/
│   └── images/
├── supabase/
│   ├── migrations/                           # alterações de banco versionadas
│   ├── seed.sql                              # dados de exemplo fictícios
│   └── tests/                                # testes de segurança RLS
├── tests/
│   ├── e2e/                                  # jornadas desktop e mobile
│   ├── accessibility/
│   └── fixtures/                             # dados de teste fictícios
├── docs/
│   ├── architecture.md
│   ├── link-behavior-matrix.md               # nova aba vs mesma aba
│   ├── privacy-and-recognition.md
│   └── runbook.md
├── .env.example                              # somente nomes, sem segredos reais
├── .gitignore
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

## Responsabilidade das pastas

- `src/app/` mapeia URLs, layouts e protege rotas. Cada arquivo `page.tsx` representa uma tela.
- `src/features/` contém regras e componentes específicos da função: comunicados, links, documentos, diretório e reconhecimento.
- `src/components/` contém elementos reaproveitáveis entre telas, sem absorver regras específicas de negócio.
- `src/lib/` agrupa integrações técnicas comuns, validação, acessibilidade e segurança.
- `supabase/migrations/` mantém as mudanças do banco reproduzíveis; `supabase/tests/` testa permissões.
- `tests/e2e/` verifica os fluxos completos em computador e celular; `fixtures/` deve usar conteúdo fictício.
- `docs/` registra arquitetura, comportamento dos links, governança dos destaques e operação.

## Regra do módulo `features/app-links/`

O catálogo guarda URL web, categoria, responsável, requisitos de login/VPN, modo de abertura e texto de orientação para cada atalho. O componente aplica estas regras:

- **Desktop:** link externo em nova aba (`target="_blank"`) e mantém o portal aberto. Informar que uma nova aba será aberta.
- **Celular:** link externo na mesma aba (`target="_self"`), substituindo a página do portal naquele contexto; o botão Voltar do navegador leva de volta ao portal.
- **Retorno mais explícito:** se a empresa controla o web app de destino, incluir nele um link “Voltar ao Portal Di Paula”. Para aplicações de terceiros, usar o histórico normal do navegador.
- **Memória:** a navegação na mesma aba evita deixar o portal e o sistema externo abertos em abas separadas; o navegador decide se mantém a página anterior em cache ou a recarrega.

Não implementar tentativa de fechar a aba ou reabrir o portal automaticamente ao encerrar o destino. Esse comportamento não é confiável em um sistema composto somente por páginas web.
