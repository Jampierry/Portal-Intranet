-- Colaborador Destaque: o período passa a ser o mês e o ano do destaque (em vez de "tipo" + rótulo livre).
ALTER TABLE destaques ADD COLUMN mes INTEGER;
ALTER TABLE destaques ADD COLUMN ano INTEGER;

-- Aproveita o que já estava cadastrado: ano = 4 últimos dígitos do rótulo; mês = nome do mês (se houver).
UPDATE destaques SET
  ano = (SELECT CAST(substr(trim(p.rotulo), -4) AS INTEGER) FROM periodos_destaque p WHERE p.id = destaques.periodo_id),
  mes = (SELECT CASE lower(substr(trim(p.rotulo), 1, 3))
            WHEN 'jan' THEN 1 WHEN 'fev' THEN 2 WHEN 'mar' THEN 3 WHEN 'abr' THEN 4 WHEN 'mai' THEN 5 WHEN 'jun' THEN 6
            WHEN 'jul' THEN 7 WHEN 'ago' THEN 8 WHEN 'set' THEN 9 WHEN 'out' THEN 10 WHEN 'nov' THEN 11 WHEN 'dez' THEN 12 END
         FROM periodos_destaque p WHERE p.id = destaques.periodo_id);
