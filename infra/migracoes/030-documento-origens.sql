-- Origens de documentos: pastas do servidor/rede cadastradas pelo administrador (ex.: RH = \\srv\rh\Documentos).
-- O documento guarda a origem (origem = 'servidor' + origem_id) e o caminho relativo dentro dela em link_oficial.
CREATE TABLE IF NOT EXISTS documento_origens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  caminho TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE documentos ADD COLUMN origem_id INTEGER REFERENCES documento_origens(id);
