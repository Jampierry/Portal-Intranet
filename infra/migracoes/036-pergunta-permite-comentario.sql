-- Nas perguntas de nota, o RH escolhe se a pessoa pode deixar um comentário. As perguntas que já existiam continuam permitindo.
ALTER TABLE pulso_perguntas ADD COLUMN permite_comentario INTEGER NOT NULL DEFAULT 1;
