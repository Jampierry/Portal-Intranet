-- Textos institucionais do Início: missao, visao e valores (um por linha). Editáveis em Publicar › Missão, Visão e Valores.
CREATE TABLE institucional (
  chave         TEXT PRIMARY KEY CHECK (chave IN ('missao', 'visao', 'valores')),
  texto         TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
