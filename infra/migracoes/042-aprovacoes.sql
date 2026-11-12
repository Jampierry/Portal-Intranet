-- Fluxo de aprovação de publicações.
-- 1) Cada pessoa pode ter "precisa de aprovação para publicar" (cadastro do usuário): o que ela publica vai para a fila do RH antes de sair.
-- 2) `aprovacoes` é a fila: um pedido por envio (comunicado do portal ou publicação para rede social), com a decisão, o motivo (rejeição) e quem decidiu.
-- 3) `publicacoes_externas` guarda o que será publicado fora do portal (Instagram etc.): plataforma, legenda, imagem e o andamento.
ALTER TABLE usuarios ADD COLUMN exige_aprovacao INTEGER NOT NULL DEFAULT 0;

CREATE TABLE publicacoes_externas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  plataforma     TEXT NOT NULL CHECK (plataforma IN ('instagram','facebook','linkedin','tiktok','youtube','whatsapp','outra')),
  titulo         TEXT NOT NULL,
  legenda        TEXT,
  imagem         TEXT,
  link           TEXT,
  data_prevista  TEXT,
  status         TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_aprovacao','aprovada','rejeitada','publicada')),
  motivo         TEXT,
  link_publicado TEXT,
  publicada_em   TEXT,
  criado_por     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL
);

CREATE TABLE aprovacoes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('comunicado','rede_social')),
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
CREATE INDEX idx_aprovacoes_status ON aprovacoes (status, criado_em);
CREATE INDEX idx_aprovacoes_registro ON aprovacoes (tipo, registro_id);

-- permissões novas: o RH decide e cuida das redes sociais; o Editor cria e envia publicações para as redes
UPDATE perfis_permissoes SET permissoes = (
  SELECT json_group_array(value) FROM (
    SELECT value FROM json_each(permissoes)
    UNION SELECT 'pub.aprovacoes.ver' UNION SELECT 'pub.aprovacoes.decidir'
    UNION SELECT 'pub.redes.ver' UNION SELECT 'pub.redes.criar' UNION SELECT 'pub.redes.editar' UNION SELECT 'pub.redes.excluir'
  )
) WHERE perfil = 'p-rh';
UPDATE perfis_permissoes SET permissoes = (
  SELECT json_group_array(value) FROM (
    SELECT value FROM json_each(permissoes) UNION SELECT 'pub.redes.ver' UNION SELECT 'pub.redes.criar' UNION SELECT 'pub.redes.editar'
  )
) WHERE perfil = 'editor';
