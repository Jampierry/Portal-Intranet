-- Biometria (passkeys / WebAuthn), "manter conectado" e uso do portal (adoção, por pessoa e por departamento).

-- Departamento de cada pessoa (usa a mesma lista dos contatos).
ALTER TABLE usuarios ADD COLUMN departamento_id INTEGER REFERENCES departamentos(id);

-- Sessão "mantida" dura mais (30 dias); a comum continua em 12 horas.
ALTER TABLE sessoes ADD COLUMN manter INTEGER NOT NULL DEFAULT 0;

-- Credenciais de biometria (digital/rosto do aparelho). Só a chave PÚBLICA fica no servidor; a biometria nunca sai do aparelho.
CREATE TABLE passkeys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  credencial_id TEXT NOT NULL UNIQUE,
  chave_publica BLOB NOT NULL,
  contador      INTEGER NOT NULL DEFAULT 0,
  transportes   TEXT,
  nome          TEXT NOT NULL,
  criado_em     TEXT NOT NULL,
  ultimo_uso    TEXT
);
CREATE INDEX passkeys_usuario ON passkeys (usuario_id);

-- Eventos de uso: um por entrada e um por tela aberta (sem conteúdo digitado). Guardados por 12 meses.
-- `dia` e `hora` são locais (AAAA-MM-DD e 0–23) para os gráficos baterem com o relógio de quem usa.
CREATE TABLE uso_eventos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  quando     TEXT NOT NULL,
  dia        TEXT NOT NULL,
  hora       INTEGER NOT NULL,
  tipo       TEXT NOT NULL,        -- 'login' | 'tela'
  tela       TEXT,
  aparelho   TEXT NOT NULL         -- 'celular' | 'computador'
);
CREATE INDEX uso_eventos_dia ON uso_eventos (dia);
CREATE INDEX uso_eventos_usuario ON uso_eventos (usuario_id, dia);
