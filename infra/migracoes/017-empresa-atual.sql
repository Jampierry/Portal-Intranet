-- Instalações que já têm usuários (o portal da Di Paula) mantêm os textos de hoje; instalações novas nascem com os padrões neutros
-- e o administrador escolhe tudo em Configurações › Empresa e Tela de entrada.
INSERT OR IGNORE INTO portal_config (chave, valor, atualizado_em)
SELECT 'empresa',
       '{"nome":"Di Paula","nome_portal":"Portal Intranet","slogan":"MODA EM MOVIMENTO","frase_rodape":"Conectando pessoas, ideias e grandes movimentos.","lema":["SONHAR","FAZ PARTE","DO NOSSO","MOVIMENTO"],"logo":null,"feriados_municipais":[{"titulo":"Nossa Senhora Auxiliadora (Goiânia)","dia":24,"mes":5},{"titulo":"Aniversário de Goiânia","dia":24,"mes":10}]}',
       datetime('now')
 WHERE EXISTS (SELECT 1 FROM usuarios);
INSERT OR IGNORE INTO portal_config (chave, valor, atualizado_em)
SELECT 'entrada',
       '{"fundo":"cor","imagens":[],"intervalo":6,"escurecer":35,"linhas":["PESSOAS","PROCESSOS","RESULTADOS"],"rodape":"MODA EM MOVIMENTO","texto_extra":""}',
       datetime('now')
 WHERE EXISTS (SELECT 1 FROM usuarios);
