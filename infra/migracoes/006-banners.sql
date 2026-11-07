-- Banners do carrossel "Novidades da semana" (Início). Sem nenhum banner ativo, o Início mostra a faixa padrão.
CREATE TABLE banners (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo        TEXT NOT NULL,
  subtitulo     TEXT,
  imagem        TEXT,
  botao_texto   TEXT,
  link          TEXT,
  ordem         INTEGER NOT NULL DEFAULT 1,
  ativo         INTEGER NOT NULL DEFAULT 1,
  exibir_de     TEXT,
  exibir_ate    TEXT,
  criado_em     TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
