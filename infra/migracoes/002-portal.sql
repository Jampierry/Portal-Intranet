-- Conteúdo do portal. Tudo de EXEMPLO até a governança ser aprovada (docs/requisitos.md, seções 6 e 7).
-- Datas em texto ISO. Booleanos como INTEGER 0/1.

CREATE TABLE departamentos (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE contatos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  departamento_id INTEGER REFERENCES departamentos(id),
  nome            TEXT NOT NULL,
  canal           TEXT NOT NULL,
  publicavel      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE aplicacoes (
  slug         TEXT PRIMARY KEY,
  nome         TEXT NOT NULL,
  descricao    TEXT NOT NULL,
  categoria    TEXT NOT NULL,
  url          TEXT NOT NULL,
  acesso       TEXT NOT NULL,
  icone        TEXT NOT NULL,
  responsavel  TEXT,
  visibilidade TEXT NOT NULL DEFAULT 'todos',
  ativo        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE favoritos (
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  aplicacao_slug TEXT NOT NULL REFERENCES aplicacoes(slug) ON DELETE CASCADE,
  criado_em      TEXT NOT NULL,
  PRIMARY KEY (usuario_id, aplicacao_slug)
);

CREATE TABLE comunicados (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  titulo       TEXT NOT NULL,
  resumo       TEXT NOT NULL,
  corpo        TEXT,
  categoria    TEXT NOT NULL,
  publico      TEXT NOT NULL DEFAULT 'todos',
  prioridade   TEXT NOT NULL DEFAULT 'normal',
  status       TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','arquivado')),
  autor_id     INTEGER REFERENCES usuarios(id),
  exibir_de    TEXT,
  exibir_ate   TEXT,
  publicado_em TEXT,
  criado_em    TEXT NOT NULL
);

CREATE TABLE documentos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  titulo        TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  resumo        TEXT NOT NULL,
  formato       TEXT NOT NULL,
  versao        TEXT,
  responsavel   TEXT,
  classificacao TEXT NOT NULL DEFAULT 'interno',
  link_oficial  TEXT,
  revisado_em   TEXT
);

CREATE TABLE periodos_destaque (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT NOT NULL CHECK (tipo IN ('mes','ano')),
  rotulo     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','expirado')),
  exibir_de  TEXT,
  exibir_ate TEXT,
  UNIQUE (tipo, rotulo)
);

-- Sem ranking e sem pontuação. Só pode ser aprovado com referência de consentimento (LGPD).
CREATE TABLE destaques (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_id        INTEGER NOT NULL REFERENCES periodos_destaque(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL,
  area              TEXT NOT NULL,
  iniciais          TEXT NOT NULL,
  apresentacao      TEXT NOT NULL,
  foto_aprovada     TEXT,
  consentimento_ref TEXT,
  status            TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado','retirado')),
  CHECK (status <> 'aprovado' OR consentimento_ref IS NOT NULL)
);

CREATE INDEX idx_comunicados_status ON comunicados(status, publicado_em);
CREATE INDEX idx_documentos_categoria ON documentos(categoria);
CREATE INDEX idx_destaques_periodo ON destaques(periodo_id);
