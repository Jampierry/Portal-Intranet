-- Anexos das publicações para redes sociais (PDF, Word, Excel, PowerPoint, imagens, SVG, texto): o RH abre e confere antes de aprovar.
-- `publicacao_id` vazio = anexo enviado mas ainda não salvo na publicação (limpo depois de 1 dia).
CREATE TABLE publicacoes_anexos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  publicacao_id INTEGER REFERENCES publicacoes_externas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  tamanho       INTEGER NOT NULL,
  dados         BLOB NOT NULL,
  criado_por    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em     TEXT NOT NULL
);
CREATE INDEX idx_publicacoes_anexos ON publicacoes_anexos (publicacao_id);
