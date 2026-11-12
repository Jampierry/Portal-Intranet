-- Data de publicação dos documentos: o documento só aparece para os colaboradores a partir desta data (vazio = já).
ALTER TABLE documentos ADD COLUMN exibir_de TEXT;
