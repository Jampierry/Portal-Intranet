-- Pessoas do mês (Início): aniversariantes e novos colaboradores, cadastrados pelo RH.
-- Só aparece no portal quem tem "autorizado" = 1 (a pessoa concordou com a divulgação, LGPD). Aniversário guarda só dia e mês (sem o ano de nascimento).
CREATE TABLE aniversariantes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  area       TEXT NOT NULL,
  dia        INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
  mes        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  foto       TEXT,
  autorizado INTEGER NOT NULL DEFAULT 0,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_aniversariantes_mes ON aniversariantes (mes, dia);

CREATE TABLE novos_colaboradores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  area       TEXT NOT NULL,
  funcao     TEXT,
  entrada    TEXT NOT NULL,
  mensagem   TEXT,
  foto       TEXT,
  autorizado INTEGER NOT NULL DEFAULT 0,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_novos_entrada ON novos_colaboradores (entrada);

-- O perfil Editor passa a cuidar também destas duas abas (outros perfis, como um "RH", são montados em Configurações › Perfis).
UPDATE perfis_permissoes SET permissoes = (
  SELECT json_group_array(value) FROM (
    SELECT value FROM json_each(permissoes)
    UNION SELECT 'pub.aniversariantes.ver' UNION SELECT 'pub.aniversariantes.criar' UNION SELECT 'pub.aniversariantes.editar' UNION SELECT 'pub.aniversariantes.excluir'
    UNION SELECT 'pub.novos.ver' UNION SELECT 'pub.novos.criar' UNION SELECT 'pub.novos.editar' UNION SELECT 'pub.novos.excluir'
  )
) WHERE perfil = 'editor';
