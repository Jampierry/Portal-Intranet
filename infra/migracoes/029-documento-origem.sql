-- Documento pode apontar para um link http(s), um arquivo na pasta de documentos do portal ou um caminho de rede.
-- O endereço continua em link_oficial; "origem" diz como interpretá-lo.
ALTER TABLE documentos ADD COLUMN origem TEXT NOT NULL DEFAULT 'link';
