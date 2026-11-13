import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { MESES_LONGOS, dataCurta } from '../dados';
import { useEmpresa } from '../empresa';
import { Capa } from '../Capa';

interface Aniv { nome: string; area: string; dia: number; mes: number; foto: string | null; iniciais: string; hoje: boolean }
interface Novo { nome: string; area: string; funcao: string | null; entrada: string; mensagem: string | null; foto: string | null; iniciais: string }
interface Casa { nome: string; area: string; foto: string | null; iniciais: string; dia: number; anos: number; hoje: boolean }
interface Resposta { mes: number; aniversariantes: Aniv[]; casa: Casa[]; novos: Novo[] }

const POR_PAGINA = 3;

interface Tile { chave: string; nome: string; foto: string | null; iniciais: string; linha: string; chip: string; dica?: string; hoje?: boolean }

/** Cartão no formato do Colaborador Destaque: 3 pessoas por página (foto quadrada, nome, detalhe e data), setas, pontos e giro automático
 *  (pausa com o mouse/foco; tempos levemente diferentes entre os cartões para não virarem todos juntos). */
function CartaoPessoas({ id, titulo, itens, deslocar = 0 }: { id: string; titulo: string; itens: Tile[]; deslocar?: number }) {
  const paginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const pag = i % paginas;
  useEffect(() => {
    if (pausa || paginas < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % paginas), 7200 + deslocar);
    return () => clearInterval(t);
  }, [pausa, paginas, deslocar]);
  const mover = (d: -1 | 1) => setI((x) => (x + d + paginas) % paginas);
  const grupos = Array.from({ length: paginas }, (_, p) => itens.slice(p * POR_PAGINA, p * POR_PAGINA + POR_PAGINA));
  return (
    <section className="cartao-sec destaques compacto pm-card" aria-labelledby={id}
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      <div className="sec-topo"><h2 id={id}><Icone nome="pessoas" tamanho={22} /> {titulo}</h2></div>
      <div className="carrossel">
        {paginas > 1 ? <button type="button" className="seta-car" onClick={() => mover(-1)} aria-label="Anteriores"><Icone nome="esq" /></button> : <span />}
        <div className="pessoas-janela">
          <div className="pessoas-trilho" style={{ transform: `translateX(-${pag * 100}%)` }}>
            {grupos.map((g, p) => (
              <div className="pessoas" key={p} aria-hidden={p !== pag}>
                {g.map((t) => (
                  <article className={`pessoa${t.hoje ? ' pm-hoje' : ''}`} key={t.chave} title={t.dica}>
                    <div className="pessoa-foto">
                      <Capa semente={t.nome} icone="pessoas" foto={t.foto} classe="capa-pessoa">{!t.foto && <span className="iniciais-capa">{t.iniciais}</span>}</Capa>
                      <span className="pessoa-periodo">{t.chip}</span>
                    </div>
                    <div><h3 title={t.nome}>{t.nome}</h3><small className="area">{t.linha}</small></div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
        {paginas > 1 ? <button type="button" className="seta-car" onClick={() => mover(1)} aria-label="Próximos"><Icone nome="dir" /></button> : <span />}
      </div>
      {paginas > 1 && <div className="pontos" aria-label={`Página ${pag + 1} de ${paginas}`}>
        {Array.from({ length: paginas }, (_, n) => <button key={n} type="button" aria-label={`Ir para a página ${n + 1}`} aria-current={n === pag ? 'true' : undefined} onClick={() => setI(n)} />)}
      </div>}
    </section>
  );
}

/** Faixa do aniversário da empresa: contagem regressiva (a partir de 60 dias antes) e comemoração no dia. */
function AniversarioEmpresa({ fundacao, nome }: { fundacao: string | null; nome: string }) {
  if (!fundacao) return null;
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const [a, m, d] = fundacao.split('-').map(Number);
  let proximo = new Date(hoje.getFullYear(), m - 1, d, 12);
  if (proximo < hoje && proximo.toDateString() !== hoje.toDateString()) proximo = new Date(hoje.getFullYear() + 1, m - 1, d, 12);
  const dias = Math.round((proximo.getTime() - hoje.getTime()) / 86_400_000);
  const anos = proximo.getFullYear() - a;
  if (anos < 1 || dias > 60) return null;
  return (
    <p className={`aniv-empresa${dias === 0 ? ' hoje' : ''}`} role="status">
      <Icone nome="calendario" tamanho={20} />
      {dias === 0 ? <span><b>Hoje a {nome} completa {anos} {anos === 1 ? 'ano' : 'anos'}!</b> Parabéns a todos que fazem essa história.</span>
        : <span>Faltam <b>{dias} {dias === 1 ? 'dia' : 'dias'}</b> para os <b>{anos} anos</b> da {nome} ({dataCurta(`${proximo.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)}).</span>}
    </p>
  );
}

/** Início: aniversariantes do mês e novos colaboradores (cadastrados pelo RH em Publicar). Só mostra o cartão se houver alguém autorizado. */
export function PessoasDoMes() {
  const [r, setR] = useState<Resposta | null>(null);
  useEffect(() => { api<Resposta>('/api/pessoas-do-mes').then(setR).catch(() => setR(null)); }, []);
  const empresa = useEmpresa();
  const aniversarioEmpresa = <AniversarioEmpresa fundacao={empresa.fundacao} nome={empresa.nome} />;
  if (!r || (r.aniversariantes.length === 0 && r.novos.length === 0 && (r.casa?.length ?? 0) === 0)) return aniversarioEmpresa;
  const mes = MESES_LONGOS[r.mes - 1].toLowerCase();
  return (
    <>
    {aniversarioEmpresa}
    <div className="pessoas-mes" aria-label="Pessoas do mês">
      {r.aniversariantes.length > 0 && (
        <CartaoPessoas id="pm-aniv" titulo={`Aniversariantes de ${mes}`}
          itens={r.aniversariantes.map((a) => ({ chave: `${a.nome}|${a.dia}`, nome: a.nome, foto: a.foto, iniciais: a.iniciais, linha: a.area, chip: a.hoje ? 'Hoje' : `${a.dia} ${mes.slice(0, 3)}`, hoje: a.hoje }))} />
      )}
      {(r.casa?.length ?? 0) > 0 && (
        <CartaoPessoas id="pm-casa" titulo="Tempo de casa" deslocar={600}
          itens={r.casa.map((a) => ({ chave: `${a.nome}|${a.dia}`, nome: a.nome, foto: a.foto, iniciais: a.iniciais, linha: `${a.anos} ${a.anos === 1 ? 'ano' : 'anos'} · ${a.area}`, chip: a.hoje ? 'Hoje' : `${a.dia} ${mes.slice(0, 3)}`, hoje: a.hoje }))} />
      )}
      {r.novos.length > 0 && (
        <CartaoPessoas id="pm-novos" titulo="Novos colaboradores" deslocar={1200}
          itens={r.novos.map((n) => ({ chave: `${n.nome}|${n.entrada}`, nome: n.nome, foto: n.foto, iniciais: n.iniciais, linha: [n.funcao, n.area].filter(Boolean).join(' · '), chip: dataCurta(n.entrada), dica: n.mensagem ?? undefined }))} />
      )}
    </div>
    </>
  );
}
