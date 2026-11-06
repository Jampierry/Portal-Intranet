-- Fundação: usuários, sessões e auditoria.
-- Datas em texto ISO (AAAA-MM-DD ou AAAA-MM-DDTHH:MM:SSZ), como no app atual.

CREATE TABLE usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  login       TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  senha_hash  TEXT NOT NULL,
  perfil      TEXT NOT NULL DEFAULT 'consulta',
  ativo       INTEGER NOT NULL DEFAULT 1,
  criado_em   TEXT NOT NULL
);

CREATE TABLE sessoes (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criada_em   TEXT NOT NULL,
  expira_em   TEXT NOT NULL
);

-- Auditoria só aceita inclusão: alterar ou apagar é bloqueado no próprio banco.
CREATE TABLE auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  quando      TEXT NOT NULL,
  usuario_id  INTEGER,
  acao        TEXT NOT NULL,
  detalhe     TEXT
);

CREATE TRIGGER auditoria_sem_update BEFORE UPDATE ON auditoria
BEGIN SELECT RAISE(ABORT, 'auditoria é somente inclusão'); END;

CREATE TRIGGER auditoria_sem_delete BEFORE DELETE ON auditoria
BEGIN SELECT RAISE(ABORT, 'auditoria é somente inclusão'); END;
