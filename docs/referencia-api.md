# Referência da API

Gerada a partir do código em 12/11/2026. Toda rota exige login, exceto `/api/saude`, `/api/login`, `/api/esqueci-senha`, `/api/empresa`, `/api/entrada` e `/api/publico/imagens/*`. A coluna **Permissão** mostra o que a rota exige além do login (administrador sempre passa). `—` = qualquer pessoa logada (o conteúdo é filtrado pelo que ela pode ver). Alterações de dados são auditadas e toda entrada é validada.

Erros: `400` entrada inválida · `401` sem login · `403` sem permissão (ou `precisa_autorizacao` ao editar conteúdo de outra pessoa) · `404` não encontrado.

## acessos
| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/login` | — |
| POST | `/api/sair` | — |
| GET | `/api/eu` | — |
| POST | `/api/eu/senha` | — |
| GET | `/api/usuarios` | cfg.usuarios.ver |
| POST | `/api/usuarios` | cfg.usuarios.criar |
| PUT | `/api/usuarios/:id` | cfg.usuarios.editar |
| POST | `/api/usuarios/:id/senha` | cfg.usuarios.senha |
| POST | `/api/esqueci-senha` | — |
| GET | `/api/gestao/pedidos-senha` | cfg.usuarios.senha |
| POST | `/api/gestao/pedidos-senha/:id/dispensar` | cfg.usuarios.senha |
| GET | `/api/perfis` | cfg.usuarios.ver, cfg.usuarios.criar, cfg.usuarios.editar, cfg.perfis.ver |
| POST | `/api/perfis` | cfg.perfis.criar |
| PUT | `/api/perfis/:codigo` | cfg.perfis.editar |
| DELETE | `/api/perfis/:codigo` | cfg.perfis.excluir |
| GET | `/api/gestao/armazenamento` | cfg.auditoria.ver (tamanho do banco, imagens e anexos) |
| GET | `/api/auditoria` | cfg.auditoria.ver |

## aplicacoes
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/aplicacoes` | — |
| GET | `/api/favoritos` | — |
| PUT | `/api/favoritos/:slug` | — |
| DELETE | `/api/favoritos/:slug` | — |
| POST | `/api/gestao/aplicacoes/icone` | pub.aplicativos.criar, pub.aplicativos.editar |
| GET | `/api/gestao/aplicacoes` | pub.aplicativos.ver |
| POST | `/api/gestao/aplicacoes` | pub.aplicativos.criar |
| PUT | `/api/gestao/aplicacoes/:slug` | pub.aplicativos.editar |
| GET | `/api/usuarios/:id/aplicativos` | cfg.usuarios.aplicativos |
| PUT | `/api/usuarios/:id/aplicativos` | cfg.usuarios.aplicativos |
| GET | `/api/aplicativos-restritos` | cfg.perfis.ver, cfg.usuarios.aplicativos |
| GET | `/api/perfis/:codigo/aplicativos` | cfg.perfis.ver |
| PUT | `/api/perfis/:codigo/aplicativos` | cfg.perfis.editar |
| DELETE | `/api/gestao/aplicacoes/:slug` | pub.aplicativos.excluir |

## aprovacoes
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/aprovacoes` | pub.aprovacoes.ver |
| POST | `/api/aprovacoes/:id/decidir` | pub.aprovacoes.decidir |
| GET | `/api/aprovacoes/caixa` | — |
| GET | `/api/aprovacoes/minhas` | — |

## avisos
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/avisos/lidos` | — |
| POST | `/api/avisos/lidos` | — |
| GET | `/api/integracoes/avisos` | cfg.integracoes.ver |
| PUT | `/api/integracoes/avisos` | cfg.integracoes.editar |
| POST | `/api/integracoes/avisos/teste` | cfg.integracoes.editar |
| GET | `/api/eu/avisos` | — |
| PUT | `/api/eu/avisos` | — |

## banners
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/banners` | — |
| GET | `/api/gestao/banners` | pub.banners.ver |
| POST | `/api/gestao/banners` | pub.banners.criar |
| PUT | `/api/gestao/banners/:id` | pub.banners.editar |
| POST | `/api/gestao/banners/:id/data` | pub.banners.editar |
| DELETE | `/api/gestao/banners/:id` | pub.banners.excluir |

## calendario
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/calendario` | ver.calendario |
| GET | `/api/gestao/calendario/datas` | calendario.criar, calendario.excluir, calendario.agendas |
| POST | `/api/gestao/calendario/datas` | calendario.criar |
| PUT | `/api/gestao/calendario/datas/:id` | calendario.criar |
| DELETE | `/api/gestao/calendario/datas/:id` | calendario.excluir |
| POST | `/api/gestao/calendario/feriados` | calendario.criar |
| GET | `/api/gestao/calendario/agendas` | calendario.criar, calendario.excluir, calendario.agendas |
| PUT | `/api/gestao/calendario/agendas` | calendario.agendas |
| POST | `/api/calendario` | calendario.criar |
| DELETE | `/api/calendario/:id` | calendario.excluir |

## comunicados
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/comunicados` | ver.comunicados |
| GET | `/api/comunicados/:slug` | ver.comunicados |
| POST | `/api/comunicados/:slug/confirmar` | ver.comunicados |
| GET | `/api/gestao/comunicados` | pub.comunicados.ver |
| POST | `/api/gestao/comunicados` | pub.comunicados.criar |
| POST | `/api/gestao/comunicados/:id/data` | pub.comunicados.editar |
| PUT | `/api/gestao/comunicados/:id` | pub.comunicados.editar |
| GET | `/api/gestao/comunicados/:id/leituras` | pub.comunicados.ver |
| DELETE | `/api/gestao/comunicados/:id` | pub.comunicados.excluir |

## demonstracao
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/gestao/demonstracao` | perfil admin |
| POST | `/api/gestao/demonstracao` | perfil admin |

## documentos
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/documentos` | ver.documentos |
| GET | `/api/documentos/:slug/arquivo` | ver.documentos |
| GET | `/api/gestao/documentos/pasta` | pub.documentos.criar, pub.documentos.editar |
| GET | `/api/gestao/documentos/origens` | pub.documentos.ver, pub.documentos.criar, pub.documentos.editar |
| GET | `/api/gestao/documentos/origens/navegar` | perfil admin |
| POST | `/api/gestao/documentos/origens` | perfil admin |
| PUT | `/api/gestao/documentos/origens/:id` | perfil admin |
| DELETE | `/api/gestao/documentos/origens/:id` | perfil admin |
| GET | `/api/gestao/documentos` | pub.documentos.ver |
| POST | `/api/gestao/documentos` | pub.documentos.criar |
| PUT | `/api/gestao/documentos/:id` | pub.documentos.editar |
| POST | `/api/gestao/documentos/:id/data` | pub.documentos.editar |
| DELETE | `/api/gestao/documentos/:id` | pub.documentos.excluir |

## imagens
| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/gestao/imagens` | ...PUB_QUE_ENVIAM_IMAGEM |
| GET | `/api/imagens/:nome` | — |
| POST | `/api/gestao/videos` | pub.banners.criar ou editar (MP4/WebM, até 20 MB) |
| GET | `/api/videos/:nome` | login; aceita Range |

## inicio
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/destaques` | — |
| GET | `/api/gestao/destaques` | pub.destaques.ver |
| POST | `/api/gestao/destaques` | pub.destaques.criar |
| PUT | `/api/gestao/destaques/:id` | pub.destaques.editar |
| DELETE | `/api/gestao/destaques/:id` | pub.destaques.excluir |

## institucional
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/institucional` | — |
| PUT | `/api/gestao/institucional` | pub.institucional.editar |

## integracoes
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/integracoes/zimbra` | cfg.integracoes.ver |
| PUT | `/api/integracoes/zimbra` | cfg.integracoes.editar |
| POST | `/api/integracoes/zimbra/testar` | cfg.integracoes.editar |
| PUT | `/api/integracoes/zimbra/config` | cfg.integracoes.editar |
| GET | `/api/integracoes/zimbra/contas` | cfg.integracoes.ver |
| POST | `/api/integracoes/zimbra/contas` | cfg.integracoes.editar |
| DELETE | `/api/integracoes/zimbra/contas/:id` | cfg.integracoes.editar |
| POST | `/api/integracoes/zimbra/contas/:id/testar` | cfg.integracoes.editar |
| GET | `/api/integracoes/zimbra/contas/:id/agendas` | cfg.integracoes.ver |
| PUT | `/api/integracoes/zimbra/oauth/cliente` | cfg.integracoes.editar |
| POST | `/api/integracoes/zimbra/oauth/iniciar` | cfg.integracoes.editar |
| GET | `/api/integracoes/zimbra/agendas` | cfg.integracoes.ver |

## marca
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/empresa` | — |
| GET | `/api/entrada` | — |
| GET | `/api/publico/imagens/:nome` | — |
| GET | `/api/publico/videos/:nome` | — (só o que a tela de entrada usa; aceita Range) |
| POST | `/api/gestao/entrada/videos` | cfg.entrada.editar |
| POST | `/api/gestao/` | — |
| PUT | `/api/gestao/empresa` | cfg.empresa.editar |
| PUT | `/api/gestao/entrada` | cfg.entrada.editar |

## perfil
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/eu/perfil` | — |
| POST | `/api/eu/foto` | — |
| DELETE | `/api/eu/foto` | — |
| GET | `/api/usuarios/:id/ficha` | cfg.usuarios.emergencia |
| PUT | `/api/eu/perfil` | — |
| PUT | `/api/eu/email` | — |

## pessoas
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/contatos` | ver.pessoas |
| GET | `/api/gestao/contatos` | pub.contatos.ver |
| POST | `/api/gestao/contatos` | pub.contatos.criar |
| PUT | `/api/gestao/contatos/:id` | pub.contatos.editar |
| DELETE | `/api/gestao/contatos/:id` | pub.contatos.excluir |

## pessoasmes
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/pessoas-do-mes` | — |
| GET | `/api/gestao/tempo-de-casa` | pub.aniversariantes.ver |
| PUT | `/api/gestao/tempo-de-casa` | pub.aniversariantes.editar |
| GET | `/api/gestao/aniversariantes` | pub.aniversariantes.ver |
| POST | `/api/gestao/aniversariantes` | pub.aniversariantes.criar |
| PUT | `/api/gestao/aniversariantes/:id` | pub.aniversariantes.editar |
| DELETE | `/api/gestao/aniversariantes/:id` | pub.aniversariantes.excluir |
| POST | `/api/gestao/aniversariantes/importar` | pub.aniversariantes.criar |
| GET | `/api/gestao/novos` | pub.novos.ver |
| POST | `/api/gestao/novos` | pub.novos.criar |
| PUT | `/api/gestao/novos/:id` | pub.novos.editar |
| DELETE | `/api/gestao/novos/:id` | pub.novos.excluir |

## propriedade
| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/pedidos-edicao` | — |
| GET | `/api/pedidos-edicao/caixa` | — |
| POST | `/api/pedidos-edicao/:id/decidir` | — |

## pulso
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/pulso` | — |
| POST | `/api/pulso/:id/responder` | — |
| GET | `/api/gestao/pulso` | pub.pulso.ver |
| POST | `/api/gestao/pulso` | pub.pulso.criar |
| PUT | `/api/gestao/pulso/:id` | pub.pulso.editar |
| POST | `/api/gestao/pulso/:id/reenviar` | pub.pulso.editar |
| GET | `/api/gestao/pulso/:id/exportar` | pub.pulso.resultado (CSV; `?rodada=`) |
| DELETE | `/api/gestao/pulso/:id` | pub.pulso.excluir |
| GET | `/api/gestao/pulso/:id/resultado` | pub.pulso.resultado |
| PUT | `/api/gestao/pulso/:id/publicacao` | pub.pulso.resultado |
| GET | `/api/pulso/resultados` | — |
| POST | `/api/pulso/resultados/:id/visto` | — |
| GET | `/api/pulso/resultados/:id` | — |

## push
| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/push/chave` | — |
| POST | `/api/push/inscrever` | — |
| POST | `/api/push/cancelar` | — |
| GET | `/api/push/meus` | — |
| POST | `/api/push/teste` | — |

## redes
| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/gestao/redes/anexos` | pub.redes.criar, pub.redes.editar |
| GET | `/api/redes/anexos/:id` | pub.redes.ver, pub.aprovacoes.ver |
| GET | `/api/gestao/redes` | pub.redes.ver |
| POST | `/api/gestao/redes` | pub.redes.criar |
| PUT | `/api/gestao/redes/:id` | pub.redes.editar |
| DELETE | `/api/gestao/redes/:id` | pub.redes.excluir |
| POST | `/api/gestao/redes/:id/enviar` | pub.redes.editar |
| POST | `/api/gestao/redes/:id/data` | pub.redes.editar |
| POST | `/api/gestao/redes/:id/publicada` | pub.redes.editar |

## servidor
| Método | Rota | Permissão |
|---|---|---|
| GET | `/` | — |
| GET | `/api/saude` | — |

Notas: `POST /api/gestao/<aba>/imagens` (marca) envia imagens da empresa e da tela de entrada (`cfg.empresa.editar` / `cfg.entrada.editar`). As rotas de calendário sob `/api/gestao/calendario/*` aceitam também `ver.calendario`/`calendario.criar` conforme a ação (ver o arquivo do módulo).
