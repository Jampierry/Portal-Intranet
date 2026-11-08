-- Perfil "RH" pronto: lê o portal e cuida das abas de pessoas em Publicar (Aniversariantes, Novos colaboradores e Pesquisa de pulso).
-- É um perfil personalizado (pode ser editado ou apagado em Configurações › Perfis). Só é criado se ainda não existir.
INSERT OR IGNORE INTO perfis_permissoes (perfil, permissoes, nome, sistema, atualizado_em) VALUES (
  'p-rh',
  '["ver.comunicados","ver.documentos","documentos.abrir","ver.calendario","ver.pessoas","ver.ajuda","pub.aniversariantes.ver","pub.aniversariantes.criar","pub.aniversariantes.editar","pub.aniversariantes.excluir","pub.novos.ver","pub.novos.criar","pub.novos.editar","pub.novos.excluir","pub.pulso.ver","pub.pulso.criar","pub.pulso.editar","pub.pulso.excluir"]',
  'RH', 0, datetime('now')
);
