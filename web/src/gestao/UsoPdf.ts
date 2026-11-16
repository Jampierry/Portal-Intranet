import { api } from '../api';
import { avisar } from '../Confirmar';
import type { Pessoa, Resumo } from './Uso';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const data = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * Relatório do painel de uso em PDF: abre uma página limpa (A4) e chama a impressão do navegador; escolha "Salvar como PDF".
 * Sem biblioteca extra. A geração fica na auditoria.
 */
export async function relatorioPdf(r: Resumo, pessoas: Pessoa[], telaNome: (t: string | null) => string): Promise<void> {
  const janela = window.open('', '_blank');
  if (!janela) { void avisar('O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.'); return; }
  await api('/api/gestao/uso/exportar-pdf', { dias: r.dias }).catch(() => { /* a auditoria não impede o relatório */ });
  const linhas = <T,>(l: T[], f: (x: T) => unknown[]) => l.map((x) => `<tr>${f(x).map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Uso do portal — ${r.dias} dias</title><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 12px/1.45 system-ui, "Segoe UI", sans-serif; color: black; background: white; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid gray; padding-bottom: 2px; }
  p.sub { margin: 0 0 10px; color: dimgray; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .kpi { border: 1px solid lightgray; border-radius: 6px; padding: 6px 10px; } .kpi b { display: block; font-size: 18px; } .kpi span { color: dimgray; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid lightgray; font-size: 11px; } th { background: whitesmoke; }
  tr { break-inside: avoid; } h2 { break-after: avoid; }
  .aviso { margin-top: 16px; color: dimgray; font-size: 10.5px; }
  @media screen { body { max-width: 190mm; margin: 16px auto; padding: 0 12px; } }
</style></head><body>
<h1>Uso do portal</h1><p class="sub">Período: ${esc(data(r.desde))} a ${esc(new Date().toLocaleDateString('pt-BR'))} (${r.dias} dias) · gerado em ${esc(new Date().toLocaleString('pt-BR'))}</p>
<div class="kpis">
  <div class="kpi"><b>${r.ativos} de ${r.cadastrados}</b><span>pessoas ativas (${pct(r.ativos, r.cadastrados)}%)</span></div>
  <div class="kpi"><b>${r.semAcesso}</b><span>sem acesso no período</span></div>
  <div class="kpi"><b>${r.serie.reduce((s, d) => s + d.entradas, 0)}</b><span>entradas (logins)</span></div>
  <div class="kpi"><b>${r.serie.reduce((s, d) => s + d.telas, 0)}</b><span>telas abertas</span></div>
  <div class="kpi"><b>${r.comunicados.publicados}</b><span>comunicados publicados</span></div>
  <div class="kpi"><b>${pct(r.comunicados.abriram, r.comunicados.esperadas)}%</b><span>comunicados lidos (${r.comunicados.abriram} de ${r.comunicados.esperadas})</span></div>
</div>
<h2>Telas mais usadas</h2><table><thead><tr><th>Tela</th><th>Acessos</th><th>Pessoas</th></tr></thead><tbody>${linhas(r.telas, (t) => [telaNome(t.tela), t.acessos, t.pessoas])}</tbody></table>
<h2>Departamentos</h2><table><thead><tr><th>Departamento</th><th>Pessoas</th><th>Ativas</th><th>Adoção</th></tr></thead><tbody>${linhas(r.departamentos, (d) => [d.nome, d.pessoas, d.ativos, `${pct(d.ativos, d.pessoas)}%`])}</tbody></table>
<h2>Comunicados: lidos × publicados</h2><table><thead><tr><th>Comunicado</th><th>Publicado em</th><th>Para</th><th>Leram</th><th>Confirmaram</th></tr></thead><tbody>${linhas(r.comunicados.itens, (c) => [c.titulo, data(c.publicado_em), c.publico, `${c.abriram} de ${c.esperadas} (${pct(c.abriram, c.esperadas)}%)`, c.exige_leitura ? c.confirmaram : 'não pede'])}</tbody></table>
<h2>Aparelhos</h2><table><thead><tr><th>Aparelho</th><th>Pessoas</th><th>Eventos</th></tr></thead><tbody>${linhas(r.aparelhos, (a) => [a.aparelho === 'celular' ? 'Celular' : 'Computador', a.pessoas, a.eventos])}</tbody></table>
<h2>Por pessoa</h2><table><thead><tr><th>Pessoa</th><th>Departamento</th><th>Último acesso</th><th>Dias ativos</th><th>Entradas</th><th>Telas</th></tr></thead><tbody>${linhas(pessoas, (p) => [p.nome, p.departamento ?? '—', p.ultimo_acesso ? data(p.ultimo_acesso) : 'Nunca', p.dias_ativos, p.entradas, p.telas])}</tbody></table>
<p class="aviso">Dados de uso identificam pessoas: use só para entender a adoção do portal. O portal registra data, tela aberta e tipo de aparelho (nada do que é digitado) e guarda 12 meses.</p>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });</script>
</body></html>`;
  janela.document.open(); janela.document.write(html); janela.document.close();
}
