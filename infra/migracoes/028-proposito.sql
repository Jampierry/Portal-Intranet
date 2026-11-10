-- Diretrizes: acrescenta o propósito (a tabela é refeita porque a lista de chaves permitidas é um CHECK; o conteúdo já publicado é mantido).
CREATE TABLE institucional_nova (
  chave         TEXT PRIMARY KEY CHECK (chave IN ('missao', 'visao', 'valores', 'proposito')),
  texto         TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
INSERT INTO institucional_nova SELECT chave, texto, atualizado_em FROM institucional;
DROP TABLE institucional;
ALTER TABLE institucional_nova RENAME TO institucional;
