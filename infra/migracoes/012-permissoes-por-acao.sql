-- Permissões por ação: cada tela e cada aba passa a ter "ver", "criar", "editar", "excluir" etc.
-- As chaves antigas (pub.x, cfg.x) deixam de existir; os perfis do sistema voltam aos padrões novos e os ajustes por usuário são limpos
-- (a função foi criada há pouco; ainda não há perfis personalizados nem ajustes em uso).
UPDATE perfis_permissoes SET permissoes = '["ver.comunicados","ver.documentos","documentos.abrir","documentos.restritos","ver.pessoas","ver.ajuda","pub.comunicados.ver","pub.comunicados.criar","pub.comunicados.editar","pub.comunicados.excluir","pub.banners.ver","pub.banners.criar","pub.banners.editar","pub.banners.excluir","pub.institucional.ver","pub.institucional.editar","pub.documentos.ver","pub.documentos.criar","pub.documentos.editar","pub.documentos.excluir","pub.destaques.ver","pub.destaques.criar","pub.destaques.editar","pub.destaques.excluir","pub.contatos.ver","pub.contatos.criar","pub.contatos.editar","pub.contatos.excluir"]' WHERE perfil = 'editor';
UPDATE perfis_permissoes SET permissoes = '["ver.comunicados","ver.documentos","documentos.abrir","ver.pessoas","ver.ajuda"]' WHERE perfil = 'consulta';
UPDATE perfis_permissoes SET permissoes = '[]' WHERE perfil NOT IN ('editor', 'consulta', 'admin');
UPDATE usuarios SET permissoes = NULL;
