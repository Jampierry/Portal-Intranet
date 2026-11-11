-- Pesquisas com várias perguntas e tipos livres (nota, escolha única, múltipla escolha, texto), com imagem na pergunta e nas opções.
-- `pulsos.pergunta` passa a ser o título da pesquisa. Cada pesquisa tem N perguntas; várias pesquisas podem estar abertas ao mesmo tempo.
-- Anonimato mantido: a resposta não guarda quem respondeu (só `pulso_participacao`, separada) nem a hora.
ALTER TABLE pulsos ADD COLUMN descricao TEXT;

CREATE TABLE pulso_perguntas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pulso_id    INTEGER NOT NULL REFERENCES pulsos(id) ON DELETE CASCADE,
  ordem       INTEGER NOT NULL DEFAULT 0,
  texto       TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('nota','unica','multipla','texto')),
  obrigatoria INTEGER NOT NULL DEFAULT 1,
  imagem      TEXT,
  opcoes      TEXT            -- JSON: [{"texto": "...", "imagem": "/api/imagens/..."}] (só unica e multipla)
);
CREATE INDEX idx_pulso_perguntas ON pulso_perguntas (pulso_id, ordem);

CREATE TABLE pulso_respostas_item (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pulso_id    INTEGER NOT NULL REFERENCES pulsos(id) ON DELETE CASCADE,
  pergunta_id INTEGER NOT NULL REFERENCES pulso_perguntas(id) ON DELETE CASCADE,
  valor       TEXT NOT NULL,  -- nota ("4"), texto da opção escolhida (uma linha por opção na múltipla) ou texto livre
  comentario  TEXT,           -- só na nota
  dia         TEXT NOT NULL
);
CREATE INDEX idx_pulso_resp_item ON pulso_respostas_item (pulso_id, pergunta_id);

-- pesquisas já existentes viram uma pergunta de nota, com as respostas e comentários que já tinham
INSERT INTO pulso_perguntas (pulso_id, ordem, texto, tipo, obrigatoria) SELECT id, 0, pergunta, 'nota', 1 FROM pulsos;
INSERT INTO pulso_respostas_item (pulso_id, pergunta_id, valor, comentario, dia)
  SELECT r.pulso_id, (SELECT q.id FROM pulso_perguntas q WHERE q.pulso_id = r.pulso_id LIMIT 1), CAST(r.nota AS TEXT), r.comentario, r.dia FROM pulso_respostas r;
DROP TABLE pulso_respostas;
