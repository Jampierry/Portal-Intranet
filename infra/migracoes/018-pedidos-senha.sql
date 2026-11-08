-- "Esqueci a senha": a pessoa avisa o administrador pela tela de entrada; o pedido fica pendente até alguém redefinir a senha ou dispensar.
CREATE TABLE pedidos_senha (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em     TEXT NOT NULL,
  resolvido_em  TEXT,
  resolvido_por INTEGER
);
CREATE INDEX idx_pedidos_senha_pendentes ON pedidos_senha (resolvido_em, usuario_id);
