# Permissões e perfis

## Como funciona
- Cada pessoa tem **um perfil**. O perfil é uma lista de permissões.
- O administrador pode **ajustar uma pessoa** (permitir ou negar um item). O ajuste **vale por cima do perfil**.
- **Administrador** sempre pode tudo e não tem lista editável.
- Em cada tela ou aba, **"ver" é o portão**: sem ele, nenhuma outra ação daquela área vale.
- Perfis do sistema: **Administrador**, **Editor**, **Consulta** (não podem ser apagados). Há também o perfil pronto **RH**. Outros perfis são criados em Configurações › Perfis.
- Definição no código: `modulos/acessos/api/permissoes.ts` (`CATALOGO`). Guardas: `exigirPerm(...)` e `exigir(...)` em `guard.ts`.

## Perfis de partida
| Perfil | Pode |
|---|---|
| Consulta | ver Comunicados, Documentos (e abrir o link), Calendário, Contatos e Ajuda |
| Editor | tudo de Publicar (criar, editar e excluir), menos Aplicativos e a aprovação do RH; sem Configurações |
| RH | ler o portal, cuidar de Aniversariantes, Novos colaboradores e Pesquisas (com resultado completo); **não** vê a lista de usuários |
| Administrador | tudo |

## Catálogo
**Telas:** `ver.comunicados`, `ver.documentos`, `documentos.abrir`, `documentos.restritos`, `ver.calendario`, `calendario.criar`, `calendario.excluir`, `calendario.agendas`, `ver.pessoas`, `ver.ajuda`.

**Publicar (abas):** para cada aba, `pub.<aba>.ver | criar | editar | excluir`. Abas: comunicados, banners, documentos, destaques, contatos, aplicativos, redes, aniversariantes, novos, pulso (Pesquisas). Casos especiais:
- `pub.institucional.ver | editar` (Missão, Visão e Valores).
- `pub.aprovacoes.ver | decidir` (fila do RH).
- `pub.<aba>.aprovacao` em comunicados, redes, banners e documentos: **a publicação da pessoa precisa da aprovação do RH**.
- `pub.pulso.resultado`: ver o resultado completo (com nomes, em pesquisa identificada) e liberar aos colaboradores.

**Configurações (abas):** `cfg.usuarios.ver | criar | editar | senha | aplicativos | emergencia`, `cfg.perfis.ver | criar | editar | excluir`, `cfg.integracoes.ver | editar`, `cfg.empresa.ver | editar`, `cfg.entrada.ver | editar`, `cfg.auditoria.ver`. As abas "Pastas de documentos" e "Dados de exemplo" são só do administrador.

## Propriedade do conteúdo (vale por cima das permissões de editar/excluir)
- Quem criou é o **dono** (`criado_por`).
- **Apagar** o que outra pessoa publicou: só o administrador.
- **Editar** o que é de outra pessoa: pede-se autorização ao dono ou ao administrador; vale por 24 horas e o pedido chega no sino de ambos.

## Contato de emergência
Cada pessoa vê só o próprio. A ficha de outra pessoa só abre para o administrador ou para quem tiver `cfg.usuarios.emergencia` (e `cfg.usuarios.ver` para chegar à lista). **Cada consulta fica na auditoria.** O perfil RH não recebe isso automaticamente.
