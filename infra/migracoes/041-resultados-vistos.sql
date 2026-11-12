-- Quem já viu (e fechou) o pop-up de um resultado divulgado. Depois disso, o resultado só aparece na tela Pesquisas do menu.
-- Vale por rodada: uma rodada nova que chegue ao mínimo de respostas é novidade de novo.
CREATE TABLE pulso_resultados_vistos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pulso_id   INTEGER NOT NULL REFERENCES pulsos(id) ON DELETE CASCADE,
  rodada     INTEGER NOT NULL,
  em         TEXT NOT NULL,
  PRIMARY KEY (usuario_id, pulso_id, rodada)
);
