-- Ordem dos favoritos na barra de aplicativos (a pessoa arrasta os ícones). Existentes seguem a ordem em que foram favoritados.
ALTER TABLE favoritos ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0;
UPDATE favoritos SET ordem = (SELECT COUNT(*) FROM favoritos f2 WHERE f2.usuario_id = favoritos.usuario_id AND (f2.criado_em < favoritos.criado_em OR (f2.criado_em = favoritos.criado_em AND f2.aplicacao_slug < favoritos.aplicacao_slug))) + 1;
