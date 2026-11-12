-- Avisos push (Web Push): cada aparelho/navegador que a pessoa ativou fica em `push_inscricoes`; o servidor manda a notificação por ali
-- (computador e celular). As chaves VAPID do servidor ficam em `portal_config` (chave `push_vapid`), geradas na primeira necessidade.
CREATE TABLE push_inscricoes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  agente     TEXT,
  criado_em  TEXT NOT NULL
);
CREATE INDEX idx_push_usuario ON push_inscricoes (usuario_id);

-- cada evento avisa uma vez só: guarda quando o aviso saiu (o passado não é avisado de novo)
ALTER TABLE comunicados ADD COLUMN push_em TEXT;
UPDATE comunicados SET push_em = datetime('now') WHERE status = 'publicado';
ALTER TABLE pulsos ADD COLUMN push_abertura_em TEXT;
ALTER TABLE pulsos ADD COLUMN push_resultado_em TEXT;
UPDATE pulsos SET push_abertura_em = datetime('now') WHERE status <> 'rascunho';
UPDATE pulsos SET push_resultado_em = datetime('now') WHERE resultado_liberado = 1;
