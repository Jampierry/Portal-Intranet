-- Contatos: ramal e celular corporativos (opcionais) além do canal (e-mail ou link).
ALTER TABLE contatos ADD COLUMN ramal TEXT;
ALTER TABLE contatos ADD COLUMN celular TEXT;
