-- Sino de avisos: o que cada pessoa já abriu ou limpou (vale em qualquer aparelho). Chaves: "urgente:<slug>" e "resposta:<id>".
-- Avisos que exigem confirmação de leitura não entram aqui: só saem do sino quando a pessoa confirma no comunicado.
CREATE TABLE avisos_lidos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave      TEXT NOT NULL,
  em         TEXT NOT NULL,
  PRIMARY KEY (usuario_id, chave)
);
