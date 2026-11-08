-- Calendário da empresa (datas locais: feriados, facultativos e eventos) e aplicativos restritos por usuário.
CREATE TABLE calendario_datas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,                 -- AAAA-MM-DD (primeiro dia)
  data_fim TEXT,                      -- AAAA-MM-DD (último dia, opcional)
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('feriado','municipal','facultativo','evento')),
  anual INTEGER NOT NULL DEFAULT 0,   -- 1 = repete todo ano no mesmo dia e mês
  criado_em TEXT NOT NULL
);
CREATE INDEX idx_calendario_datas_data ON calendario_datas (data);

-- Aplicativo restrito só aparece para quem for liberado em Configurações › Usuários › Aplicativos (administrador sempre vê).
ALTER TABLE aplicacoes ADD COLUMN restrita INTEGER NOT NULL DEFAULT 0;
CREATE TABLE usuarios_aplicativos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  aplicacao_slug TEXT NOT NULL REFERENCES aplicacoes(slug) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, aplicacao_slug)
);
