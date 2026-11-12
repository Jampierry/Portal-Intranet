-- O RH pode mostrar aos colaboradores só a opção mais votada de uma pergunta (escolha única ou múltipla), sem o gráfico completo.
ALTER TABLE pulso_perguntas ADD COLUMN publico_vencedora INTEGER NOT NULL DEFAULT 0;
