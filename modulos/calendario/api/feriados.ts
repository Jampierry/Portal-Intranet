// Feriados do ano para o botão "Gerar feriados" (Configurações › Calendário): nacionais, municipais da empresa (Configurações › Empresa) e pontos facultativos.
// O administrador decide depois quais manter (editar ou excluir). Páscoa pelo algoritmo de Gauss/Meeus (mesmo do app de comissão).
export type TipoData = 'feriado' | 'municipal' | 'facultativo' | 'evento';
export interface DataGerada { data: string; titulo: string; tipo: TipoData; anual: boolean }

const dois = (n: number) => String(n).padStart(2, '0');
const iso = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`; };
const somar = (d: string, n: number) => { const [a, m, dd] = d.split('-').map(Number); return iso(Date.UTC(a, m - 1, dd + n)); };

export function pascoa(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(Date.UTC(y, mes - 1, dia));
}

export function feriadosDoAno(y: number, municipais: { titulo: string; dia: number; mes: number }[] = []): DataGerada[] {
  const p = pascoa(y);
  const fixo = (md: string, titulo: string, tipo: TipoData = 'feriado'): DataGerada => ({ data: `${y}-${md}`, titulo, tipo, anual: true });
  const movel = (data: string, titulo: string, tipo: TipoData): DataGerada => ({ data, titulo, tipo, anual: false });
  return [
    fixo('01-01', 'Confraternização Universal'), movel(somar(p, -48), 'Carnaval (segunda)', 'facultativo'), movel(somar(p, -47), 'Carnaval (terça)', 'facultativo'),
    movel(somar(p, -2), 'Sexta-feira Santa', 'feriado'), fixo('04-21', 'Tiradentes'), fixo('05-01', 'Dia do Trabalho'),
    movel(somar(p, 60), 'Corpus Christi', 'facultativo'),
    fixo('09-07', 'Independência do Brasil'), fixo('10-12', 'Nossa Senhora Aparecida'),
    fixo('11-02', 'Finados'), fixo('11-15', 'Proclamação da República'), fixo('11-20', 'Consciência Negra'), fixo('12-25', 'Natal'),
    ...municipais.map((m) => fixo(`${dois(m.mes)}-${dois(m.dia)}`, m.titulo, 'municipal')),
  ].sort((a, b) => a.data.localeCompare(b.data));
}
