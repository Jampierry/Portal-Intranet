-- Resultado completo das pesquisas (nomes, detalhe e liberação aos colaboradores) só para o administrador e o perfil RH.
-- Nova permissão `pub.pulso.resultado`: entra no perfil RH; o Editor deixa de ver resultados (continua podendo montar pesquisas).
UPDATE perfis_permissoes SET permissoes = (
  SELECT json_group_array(value) FROM (SELECT value FROM json_each(permissoes) UNION SELECT 'pub.pulso.resultado')
) WHERE perfil = 'p-rh';
