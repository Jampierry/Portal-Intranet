-- Configuração da tela de entrada (login): fundo da lateral, marca, lema e textos. Um JSON por chave.
CREATE TABLE portal_config (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL,
  atualizado_em TEXT
);
