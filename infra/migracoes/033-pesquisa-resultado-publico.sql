-- O RH decide o que os colaboradores veem do resultado: a pesquisa só aparece para eles quando `resultado_liberado = 1`;
-- cada pergunta escolhe se o resultado dela aparece (`publico_resultado`) e se comentários/respostas em texto aparecem (`publico_textos`).
-- Nomes (pesquisa identificada) nunca vão para os colaboradores.
ALTER TABLE pulsos ADD COLUMN resultado_liberado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pulsos ADD COLUMN liberado_em TEXT;
ALTER TABLE pulso_perguntas ADD COLUMN publico_resultado INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pulso_perguntas ADD COLUMN publico_textos INTEGER NOT NULL DEFAULT 0;
