-- Pesquisa identificada: o RH escolhe ao criar se a pesquisa é anônima (padrão) ou não.
-- Só nas identificadas a resposta guarda quem respondeu (usuario_id); nas anônimas continua NULL.
ALTER TABLE pulsos ADD COLUMN anonima INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pulso_respostas_item ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
