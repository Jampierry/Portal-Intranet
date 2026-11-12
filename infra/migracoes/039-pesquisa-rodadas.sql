-- Rodadas: a mesma pesquisa pode ser enviada de novo. "Para todos" abre uma nova rodada (todos respondem outra vez, com resultado separado);
-- "só quem ainda não respondeu" continua a mesma rodada com um novo período e avisa só os pendentes.
ALTER TABLE pulsos ADD COLUMN rodada INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pulsos ADD COLUMN push_so_pendentes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pulso_respostas_item ADD COLUMN rodada INTEGER NOT NULL DEFAULT 1;

-- a participação passa a valer por rodada (a chave primária muda, então a tabela é refeita)
CREATE TABLE pulso_participacao_nova (
  pulso_id   INTEGER NOT NULL REFERENCES pulsos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rodada     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (pulso_id, usuario_id, rodada)
);
INSERT INTO pulso_participacao_nova (pulso_id, usuario_id, rodada) SELECT pulso_id, usuario_id, 1 FROM pulso_participacao;
DROP TABLE pulso_participacao;
ALTER TABLE pulso_participacao_nova RENAME TO pulso_participacao;

-- histórico de períodos: um registro por rodada
CREATE TABLE pulso_rodadas (
  pulso_id  INTEGER NOT NULL REFERENCES pulsos(id) ON DELETE CASCADE,
  rodada    INTEGER NOT NULL,
  abre_em   TEXT,
  fecha_em  TEXT,
  publico   TEXT NOT NULL DEFAULT 'todos' CHECK (publico IN ('todos','pendentes')),
  criado_em TEXT NOT NULL,
  PRIMARY KEY (pulso_id, rodada)
);
INSERT INTO pulso_rodadas (pulso_id, rodada, abre_em, fecha_em, publico, criado_em) SELECT id, 1, abre_em, fecha_em, 'todos', criado_em FROM pulsos;
