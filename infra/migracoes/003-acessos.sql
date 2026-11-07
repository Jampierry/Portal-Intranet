-- Acessos: login local criado pelo administrador master, bloqueio por tentativas e carimbos de edição.
ALTER TABLE usuarios ADD COLUMN trocar_senha INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN ultimo_acesso TEXT;

-- Tentativas de login que falharam (chave = login em minúsculas). Limpas no login correto.
CREATE TABLE tentativas_login (
  chave  TEXT NOT NULL,
  quando TEXT NOT NULL
);
CREATE INDEX idx_tentativas_login ON tentativas_login(chave, quando);

ALTER TABLE comunicados ADD COLUMN atualizado_em TEXT;
ALTER TABLE documentos ADD COLUMN atualizado_em TEXT;
