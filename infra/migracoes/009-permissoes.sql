-- Permissões editáveis: por perfil (lista de chaves) e ajustes por usuário (JSON {chave: true|false}).
CREATE TABLE perfis_permissoes (
  perfil     TEXT PRIMARY KEY,
  permissoes TEXT NOT NULL,
  atualizado_em TEXT
);
INSERT INTO perfis_permissoes (perfil, permissoes) VALUES
  ('editor', '["ver.comunicados","ver.documentos","ver.pessoas","ver.ajuda","pub.comunicados","pub.banners","pub.institucional","pub.documentos","pub.destaques","pub.contatos"]'),
  ('consulta', '["ver.comunicados","ver.documentos","ver.pessoas","ver.ajuda"]');

ALTER TABLE usuarios ADD COLUMN permissoes TEXT;
