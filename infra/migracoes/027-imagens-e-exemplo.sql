-- Imagens passam a ser guardadas no banco (valem em qualquer máquina e no celular, sem depender de pasta do servidor)
-- e o pacote de dados de exemplo passa a ser rastreável (ligar/desligar em Configurações › Dados de exemplo).
CREATE TABLE IF NOT EXISTS imagens_arquivo (
  nome TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  dados BLOB NOT NULL,
  criado_em TEXT NOT NULL
);
-- Cada linha criada pelo pacote de exemplo é anotada aqui; desligar apaga só o que está anotado.
-- anterior/aplicado: para configurações (empresa, tela de entrada, missão...) guardam o valor de antes e o que o pacote gravou.
CREATE TABLE IF NOT EXISTS dados_exemplo (
  tabela TEXT NOT NULL,
  chave TEXT NOT NULL,
  anterior TEXT,
  aplicado TEXT,
  PRIMARY KEY (tabela, chave)
);
