-- Integrações: conexão do portal com serviços externos (Zimbra/zimbra-mcp). Valores em texto; o token nunca volta para o navegador.
CREATE TABLE integracoes (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL,
  atualizado_em TEXT
);

-- Novas permissões: calendário (ver) para todos os perfis que já existem; criar/excluir datas para o Editor.
UPDATE perfis_permissoes
   SET permissoes = (SELECT json_group_array(v) FROM (SELECT value AS v FROM json_each(permissoes) UNION SELECT 'ver.calendario'))
 WHERE perfil <> 'admin';
UPDATE perfis_permissoes
   SET permissoes = (SELECT json_group_array(v) FROM (SELECT value AS v FROM json_each(permissoes) UNION SELECT 'calendario.criar' UNION SELECT 'calendario.excluir'))
 WHERE perfil = 'editor';
