-- Público de comunicados e pesquisas: o RH escolhe departamentos. Sem linhas = todos.
-- (Só por departamento, de propósito: escolher pessoas uma a uma quebraria o anonimato das pesquisas.)
CREATE TABLE publico_departamentos (
  tipo            TEXT    NOT NULL CHECK (tipo IN ('comunicado','pulso')),
  registro_id     INTEGER NOT NULL,
  departamento_id INTEGER NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  PRIMARY KEY (tipo, registro_id, departamento_id)
);
CREATE INDEX idx_publico_dep ON publico_departamentos (departamento_id);

-- Quem abriu cada comunicado (primeira vez): alimenta "lidos × publicados" no painel de uso.
CREATE TABLE comunicado_aberturas (
  comunicado_id INTEGER NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  aberto_em     TEXT    NOT NULL,
  PRIMARY KEY (comunicado_id, usuario_id)
);

-- Biometria como segundo fator (opcional, escolhido pela própria pessoa): com 1, o login por senha só conclui depois da biometria.
ALTER TABLE usuarios ADD COLUMN segundo_fator INTEGER NOT NULL DEFAULT 0;
