// Tipos de data do calendário da empresa (compartilhado entre a tela do Calendário e Configurações › Calendário).
export type TipoData = 'feriado' | 'municipal' | 'facultativo' | 'evento';
export interface DataLocal { id: number; data: string; data_fim: string | null; titulo: string; tipo: TipoData; anual: number | boolean }

export const TIPOS_DATA: [TipoData, string][] = [
  ['feriado', 'Feriado nacional'], ['municipal', 'Feriado municipal'], ['facultativo', 'Ponto facultativo'], ['evento', 'Evento / data importante'],
];
export const NOME_TIPO: Record<TipoData, string> = Object.fromEntries(TIPOS_DATA) as Record<TipoData, string>;

/** A aba Configurações › Calendário aparece para quem cadastra, exclui datas ou escolhe as agendas. */
export const podeAbaCalendario = (permissoes: string[]) => ['calendario.criar', 'calendario.excluir', 'calendario.agendas'].some((p) => permissoes.includes(p));

export const dois = (n: number) => String(n).padStart(2, '0');
export const isoDe = (a: number, m: number, d: number) => `${a}-${dois(m + 1)}-${dois(d)}`;
export const somarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDe(d.getFullYear(), d.getMonth(), d.getDate()); };
/** Todos os dias (AAAA-MM-DD) entre o início e o fim, limitados a 62. */
export function diasEntre(ini: string, fim: string | null | undefined): string[] {
  const f = (fim || ini).slice(0, 10), saida: string[] = [];
  let d = ini.slice(0, 10);
  for (let i = 0; i < 62 && d <= f; i++) { saida.push(d); d = somarDias(d, 1); }
  return saida.length ? saida : [ini.slice(0, 10)];
}
