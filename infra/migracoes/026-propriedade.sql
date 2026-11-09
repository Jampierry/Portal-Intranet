-- Dono de cada conteúdo publicado e pedidos de autorização para editar o que outra pessoa criou.
-- Regra: só o administrador apaga o que é de outra pessoa; para editar, o dono (ou o administrador) precisa autorizar.
ALTER TABLE comunicados ADD COLUMN criado_por INTEGER;
ALTER TABLE banners ADD COLUMN criado_por INTEGER;
ALTER TABLE documentos ADD COLUMN criado_por INTEGER;
ALTER TABLE destaques ADD COLUMN criado_por INTEGER;
ALTER TABLE contatos ADD COLUMN criado_por INTEGER;
ALTER TABLE aplicacoes ADD COLUMN criado_por INTEGER;
ALTER TABLE aniversariantes ADD COLUMN criado_por INTEGER;
ALTER TABLE novos_colaboradores ADD COLUMN criado_por INTEGER;
ALTER TABLE pulsos ADD COLUMN criado_por INTEGER;
ALTER TABLE calendario_datas ADD COLUMN criado_por INTEGER;
UPDATE comunicados SET criado_por = autor_id;

-- Dono dos eventos da agenda do Zimbra criados pelo portal (o evento em si fica no Zimbra).
CREATE TABLE calendario_eventos_dono (
  evento_id  TEXT PRIMARY KEY,
  titulo     TEXT,
  criado_por INTEGER
);

CREATE TABLE pedidos_edicao (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  recurso        TEXT NOT NULL,
  registro       TEXT NOT NULL,
  titulo         TEXT,
  solicitante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dono_id        INTEGER,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','negado')),
  criado_em      TEXT NOT NULL,
  decidido_em    TEXT,
  decidido_por   INTEGER
);
CREATE INDEX idx_pedidos_edicao ON pedidos_edicao (status, dono_id, solicitante_id);
