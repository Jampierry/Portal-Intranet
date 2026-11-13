# Documentação do Portal Intranet Di Paula

Atualizada em 12/11/2026. Idioma: português do Brasil. **Todos os dados do portal são fictícios nesta fase** (empresa de exemplo "Aurora Esportes").

## Para quem usa o portal
| Manual | Quem lê |
|---|---|
| **Os manuais têm prints com setas** (`docs/manuais/img/`); para refazer depois de mudar uma tela: `npm run dev` e `npm run manuais:prints` (roteiros em `scripts/manuais-roteiros.mjs`). | |
| [Manual do colaborador](manuais/manual-colaborador.md) | todas as pessoas: entrar, navegar, comunicados, documentos, pesquisas, calendário, Meu perfil |
| [Manual de quem publica](manuais/manual-publicacao.md) | editores e Marketing: Publicar (comunicados, banners, documentos, redes, destaques, contatos, aplicativos) |
| [Manual do RH](manuais/manual-rh.md) | RH: aprovações, pesquisas, aniversariantes, novos colaboradores, contato de emergência |
| [Manual do administrador](manuais/manual-administrador.md) | admin e TI: usuários, perfis, empresa, tela de entrada, integrações, auditoria, backup |

## Para quem mantém o sistema
| Documento | Conteúdo |
|---|---|
| [Visão geral e arquitetura](arquitetura.md) | pilha, pastas, fluxo de uma requisição, regras do domínio, segurança |
| [Referência da API](referencia-api.md) | todas as rotas, com a permissão exigida |
| [Banco de dados](banco-de-dados.md) | tabelas e histórico das 48 migrações |
| [Permissões e perfis](permissoes-e-perfis.md) | catálogo de permissões e como o perfil e o ajuste por pessoa se combinam |
| [**Pendências da TI**](pendencias-ti.md) | **checklist do que a TI precisa fazer para ir à produção** |
| [Implantação](implantacao.md) | ambientes, `.env`, instalação, atualização, rollback e backup |
| [**Revisão do sistema**](revisao-do-sistema-2026-11-12.md) | **o que melhorar e o que ainda falta fazer** |
| [Melhorias futuras](melhorias-futuras.md) · [Requisitos](requisitos.md) · [Decisões](decisoes.md) · [Roteiro](roteiro-modulos.md) | planejamento |
| [Memória portátil](memoria/MEMORY.md) | estado e pontos de parada do trabalho |
