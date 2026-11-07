-- Perfis personalizados: cada perfil tem nome e lista de permissões; Administrador, Editor e Consulta são os perfis do sistema.
ALTER TABLE perfis_permissoes ADD COLUMN nome TEXT;
ALTER TABLE perfis_permissoes ADD COLUMN sistema INTEGER NOT NULL DEFAULT 0;
UPDATE perfis_permissoes SET nome = 'Editor', sistema = 1 WHERE perfil = 'editor';
UPDATE perfis_permissoes SET nome = 'Consulta', sistema = 1 WHERE perfil = 'consulta';
INSERT INTO perfis_permissoes (perfil, permissoes, nome, sistema) VALUES ('admin', '[]', 'Administrador', 1);
