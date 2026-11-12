-- Período em que a pesquisa fica no ar: `abre_em` e `fecha_em` (data e hora locais, AAAA-MM-DDTHH:MM). Vazios = sem limite.
-- Só vale para pesquisas com situação "Aberta": antes de `abre_em` ela está agendada; depois de `fecha_em` encerra sozinha.
ALTER TABLE pulsos ADD COLUMN abre_em TEXT;
ALTER TABLE pulsos ADD COLUMN fecha_em TEXT;
