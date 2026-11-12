-- Meu perfil: dados que a própria pessoa cadastra (contato e emergência). Visíveis só para ela.
CREATE TABLE usuarios_perfil (
  usuario_id          INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  apelido             TEXT,
  celular             TEXT,
  email_alternativo   TEXT,
  emergencia1_nome    TEXT,
  emergencia1_parent  TEXT,
  emergencia1_tel     TEXT,
  emergencia2_nome    TEXT,
  emergencia2_parent  TEXT,
  emergencia2_tel     TEXT,
  observacao_saude    TEXT,
  atualizado_em       TEXT NOT NULL
);
