-- Confirmação de leitura: o comunicado pode exigir que cada pessoa confirme que leu ("Li e estou ciente"); a tabela guarda quem e quando.
ALTER TABLE comunicados ADD COLUMN exige_leitura INTEGER NOT NULL DEFAULT 0;
CREATE TABLE comunicado_leituras (
  comunicado_id INTEGER NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  lido_em       TEXT NOT NULL,
  PRIMARY KEY (comunicado_id, usuario_id)
);
