import type { ReactNode } from 'react';

/** Texto corrido: **negrito**, `código` e [texto](endereço). Só endereços http(s) viram link; o resto fica como texto. */
function inline(t: string, chave: string): ReactNode[] {
  const saida: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let ultimo = 0, n = 0, m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > ultimo) saida.push(t.slice(ultimo, m.index));
    const k = `${chave}-${n++}`;
    if (m[1] !== undefined) saida.push(<b key={k}>{m[1]}</b>);
    else if (m[2] !== undefined) saida.push(<code key={k}>{m[2]}</code>);
    else saida.push(/^https?:\/\//i.test(m[4]) ? <a key={k} href={m[4]} target="_blank" rel="noopener noreferrer">{m[3]}</a> : <span key={k}>{m[3]}</span>);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < t.length) saida.push(t.slice(ultimo));
  return saida;
}

const celulas = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const ITEM = /^\s*([-*]|\d+\.)\s+/;

/** Leitor mínimo de Markdown (títulos, listas, tabelas, citações e parágrafos), sem HTML bruto. */
export function Markdown({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const blocos: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const Tag = `h${Math.min(h[1].length + 1, 4)}` as 'h2' | 'h3' | 'h4'; // o título da página já é o h1
      blocos.push(<Tag key={k++}>{inline(h[2], `h${k}`)}</Tag>); i++; continue;
    }
    if (ITEM.test(l)) {
      const ordenada = /^\s*\d+\./.test(l), itens: string[] = [];
      while (i < linhas.length && ITEM.test(linhas[i])) { itens.push(linhas[i].replace(ITEM, '')); i++; }
      const Lista = ordenada ? 'ol' : 'ul';
      blocos.push(<Lista key={k++}>{itens.map((t, j) => <li key={j}>{inline(t, `l${k}-${j}`)}</li>)}</Lista>); continue;
    }
    if (l.trim().startsWith('|')) {
      const tab: string[][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith('|')) { if (!/^\s*\|[\s:|-]+\|\s*$/.test(linhas[i])) tab.push(celulas(linhas[i])); i++; }
      const [cab, ...corpo] = tab;
      blocos.push(<div key={k++} className="manual-tabela"><table><thead><tr>{cab.map((c, j) => <th key={j}>{inline(c, `c${k}-${j}`)}</th>)}</tr></thead>
        <tbody>{corpo.map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j}>{inline(c, `d${k}-${a}-${j}`)}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    if (l.startsWith('>')) {
      const partes: string[] = [];
      while (i < linhas.length && linhas[i].startsWith('>')) { partes.push(linhas[i].replace(/^>\s?/, '')); i++; }
      blocos.push(<blockquote key={k++}>{inline(partes.join(' '), `q${k}`)}</blockquote>); continue;
    }
    const par: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,4}\s|\||>)/.test(linhas[i]) && !ITEM.test(linhas[i])) { par.push(linhas[i].trim()); i++; }
    blocos.push(<p key={k++}>{inline(par.join(' '), `p${k}`)}</p>);
  }
  return <div className="manual-texto">{blocos}</div>;
}
