-- A aprovação do RH passa a ser definida por aba de Publicar (permissão `pub.<aba>.aprovacao`, no perfil ou no ajuste de cada usuário),
-- no lugar da marca única por usuário. Abas: comunicados, redes, banners e documentos.
-- 1) quem já tinha "precisa de aprovação" mantém a exigência em comunicados e redes sociais
UPDATE usuarios SET permissoes = json_set(COALESCE(permissoes, '{}'), '$."pub.comunicados.aprovacao"', json('true'), '$."pub.redes.aprovacao"', json('true'))
 WHERE exige_aprovacao = 1;
-- 2) documentos passam a ter situação de publicação (0 = aguardando aprovação do RH)
ALTER TABLE documentos ADD COLUMN publicado INTEGER NOT NULL DEFAULT 1;
-- 3) a fila aceita também banners e documentos (o CHECK do tipo não pode ser alterado: recria a tabela)
CREATE TABLE aprovacoes_nova (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('comunicado','rede_social','banner','documento')),
  registro_id    INTEGER NOT NULL,
  titulo         TEXT NOT NULL,
  detalhe        TEXT,
  solicitante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','cancelado')),
  motivo         TEXT,
  decidido_por   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  decidido_em    TEXT,
  criado_em      TEXT NOT NULL
);
INSERT INTO aprovacoes_nova SELECT id, tipo, registro_id, titulo, detalhe, solicitante_id, status, motivo, decidido_por, decidido_em, criado_em FROM aprovacoes;
DROP TABLE aprovacoes;
ALTER TABLE aprovacoes_nova RENAME TO aprovacoes;
CREATE INDEX idx_aprovacoes_status ON aprovacoes (status, criado_em);
CREATE INDEX idx_aprovacoes_registro ON aprovacoes (tipo, registro_id);
