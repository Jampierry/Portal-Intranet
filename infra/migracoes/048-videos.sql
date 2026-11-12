-- Vídeos curtos (MP4/WebM) para banners e tela de entrada. Ficam no banco, como as imagens (tabela imagens_arquivo),
-- em tabela própria para não pesar a leitura das imagens. Entrega por trechos (Range) pela API.
CREATE TABLE IF NOT EXISTS videos_arquivo (
  nome TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  dados BLOB NOT NULL,
  criado_em TEXT NOT NULL
);
