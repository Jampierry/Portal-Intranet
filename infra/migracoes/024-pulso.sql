-- Pesquisa de pulso: uma pergunta curta por vez (nota de 1 a 5 e comentário opcional), respondida de forma ANÔNIMA.
-- Anonimato: quem respondeu (pulso_participacao) fica em tabela separada das respostas; a resposta não guarda usuário nem hora,
-- só o dia. O resultado só aparece com um mínimo de respostas (ver modulos/pulso).
CREATE TABLE pulsos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  pergunta  TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aberto','encerrado')),
  criado_em TEXT NOT NULL,
  aberto_em TEXT,
  encerrado_em TEXT
);
CREATE TABLE pulso_respostas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pulso_id   INTEGER NOT NULL REFERENCES pulsos(id) ON DELETE CASCADE,
  nota       INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  dia        TEXT NOT NULL
);
CREATE INDEX idx_pulso_respostas ON pulso_respostas (pulso_id);
CREATE TABLE pulso_participacao (
  pulso_id   INTEGER NOT NULL REFERENCES pulsos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (pulso_id, usuario_id)
);

UPDATE perfis_permissoes SET permissoes = (
  SELECT json_group_array(value) FROM (
    SELECT value FROM json_each(permissoes)
    UNION SELECT 'pub.pulso.ver' UNION SELECT 'pub.pulso.criar' UNION SELECT 'pub.pulso.editar' UNION SELECT 'pub.pulso.excluir'
  )
) WHERE perfil = 'editor';
