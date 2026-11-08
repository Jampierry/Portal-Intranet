-- Aviso de novos comunicados por e-mail (via serviço Zimbra). Cada pessoa tem um e-mail (opcional, cadastrado pelo administrador)
-- e pode desligar os avisos em "Minha conta". O comunicado guarda quando já foi avisado, para não repetir ao editar.
ALTER TABLE usuarios ADD COLUMN email TEXT;
ALTER TABLE usuarios ADD COLUMN avisos_email INTEGER NOT NULL DEFAULT 1;
ALTER TABLE comunicados ADD COLUMN notificado_em TEXT;
-- O que já estava publicado antes deste recurso não dispara aviso.
UPDATE comunicados SET notificado_em = datetime('now') WHERE status = 'publicado';
