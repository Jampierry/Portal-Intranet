/** Nomes de pessoas, áreas e departamentos aparecem sempre em CAIXA ALTA nas telas e tabelas, não importa como foram cadastrados.
 *  Só exibição: o que está salvo no banco não muda. */
export const maiusc = (t: string | null | undefined): string => (t ?? '').toLocaleUpperCase('pt-BR');
