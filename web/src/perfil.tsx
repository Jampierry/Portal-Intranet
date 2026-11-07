import { useEffect, useId, useRef, useState } from 'react';

// Perfil local (ainda não há login): nome e avatar ficam só neste navegador. Avatares vindos do PREMIA.
export interface Perfil { nome: string; avatar: number | null }
const CHAVE = 'portal.perfil';
const PADRAO: Perfil = { nome: 'Visitante', avatar: null };

function ler(): Perfil {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
    return { nome: typeof v.nome === 'string' && v.nome.trim() ? v.nome.slice(0, 40) : PADRAO.nome, avatar: Number.isInteger(v.avatar) && v.avatar >= 0 && v.avatar < AVATARES.length ? v.avatar : null };
  } catch { return PADRAO; }
}
export function usePerfil() {
  const [perfil, setPerfil] = useState<Perfil>(ler);
  useEffect(() => { try { localStorage.setItem(CHAVE, JSON.stringify(perfil)); } catch { /* vale só nesta sessão */ } }, [perfil]);
  return { perfil, mudarPerfil: (p: Partial<Perfil>) => setPerfil((x) => ({ ...x, ...p })) };
}

export const iniciais = (n: string) => {
  const p = n.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

/** Saudação pela hora do dia. */
export function saudacao(d = new Date()) { const h = d.getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

// [fundo 1, fundo 2, pele, cabelo, penteado, roupa, acessórios]
const AV_PELE = ['#FBE0CF', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#FFDBAC'];
const AV_CAB = ['#2C1B12', '#5A3825', '#A0522D', '#D9A441', '#141414', '#9A9A9A'];
const AVATARES: [string, string, number, number, string, string, string][] = [
  ['#2E7DD7', '#7DB8F5', 0, 1, 'curto', '#1F4E99', 'fita'], ['#14A38B', '#6FE0C8', 2, 0, 'longo', '#0F766E', ''],
  ['#E0812B', '#F8C27A', 4, 4, 'cacheado', '#B4471A', ''], ['#8B5CF6', '#C4B2FB', 1, 3, 'coque', '#5B21B6', 'oculos'],
  ['#E5534B', '#F6A39E', 3, 0, 'raspado', '#991B1B', 'barba'], ['#0EA5E9', '#8ADCF9', 5, 2, 'franja', '#075985', 'fone'],
  ['#D946EF', '#F0A8F8', 2, 1, 'rabo', '#9D174D', ''], ['#65A30D', '#B4E06A', 4, 4, 'careca', '#3F6212', 'oculos barba'],
  ['#F59E0B', '#FDE08A', 1, 1, 'curto', '#334155', 'capacete'], ['#64748B', '#B6C2D1', 0, 5, 'curto', '#1E293B', 'oculos barba'],
  ['#BE185D', '#F59AC6', 3, 4, 'longo', '#701A45', 'fita'], ['#0F766E', '#5EEAD4', 5, 3, 'cacheado', '#115E59', ''],
  ['#4F46E5', '#A5A1F7', 2, 0, 'bone', '#312E81', ''], ['#F97362', '#FDC0B5', 0, 2, 'longo', '#9A3412', 'oculos'],
  ['#475569', '#A3B1C2', 4, 4, 'coque', '#0F172A', 'fone'], ['#84CC16', '#D2F28A', 1, 0, 'franja', '#365314', 'barba'],
];

function avatarSvg(i: number, uid: string): string {
  const [c1, c2, pi, hi, pen, roupa, acs] = AVATARES[i] ?? AVATARES[0];
  const pele = AV_PELE[pi], cab = AV_CAB[hi], tem = (k: string) => acs.split(' ').includes(k), id = 'avg' + uid;
  const costas = ({
    longo: `<path d="M17 31C16 14 24 9 32 9s16 5 15 22l1 17c-4 3-8 0-8-5H24c0 5-4 8-8 5z" fill="${cab}"/>`,
    rabo: `<path d="M42 22c8 1 10 10 8 19-1 5-5 6-6 2 2-6 1-12-3-15z" fill="${cab}"/>`,
    coque: `<circle cx="32" cy="10" r="6.5" fill="${cab}"/>`,
  } as Record<string, string>)[pen] ?? '';
  const frente = ({
    curto: `<path d="M19.5 27C19 14 26 10.5 32.5 10.5S45.5 14 44.5 27c-2-6-6.5-8.5-12.5-8.5S21.5 21 19.5 27z" fill="${cab}"/>`,
    longo: `<path d="M19.5 28C19 14 26 10.5 32.5 10.5S45.5 14 44.5 28c-4-5-9-8-15-10-2 4-6 7-10 10z" fill="${cab}"/>`,
    franja: `<path d="M19.5 28C18.5 15 26 10 33 10.5s12.5 6 11.5 17.5c-3-6-10-6-16-10.5-1.5 4.5-5 8-9 10.5z" fill="${cab}"/>`,
    rabo: `<path d="M19.5 27C19 14 26 10.5 32.5 10.5S45.5 14 44.5 27c-3-5-8-8-14-8.5-4 0-8 2.5-11 8.5z" fill="${cab}"/>`,
    coque: `<path d="M19.5 26C19.5 15 26 12.5 32 12.5s12.5 2.5 12.5 13.5c-2.5-5-7-7-12.5-7s-10 2-12.5 7z" fill="${cab}"/>`,
    cacheado: [[21, 23, 5.5], [25, 16.5, 6.5], [32, 13, 7], [39, 15.5, 6.5], [43.5, 22, 5.5], [19.5, 29, 3.6], [44.5, 28.5, 3.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${cab}"/>`).join(''),
    raspado: `<path d="M20.5 25C20.5 15.5 26 13 32 13s11.5 2.5 11.5 12c-3-4.5-7.5-6-11.5-6s-8.5 1.5-11.5 6z" fill="${cab}" opacity=".85"/>`,
    bone: `<path d="M19 25c0-9 6-14 13-14s13 5 13 14z" fill="${roupa}"/><path d="M30 24.5h20c1 0 1.5 1.6.5 2.2-3 1.6-8 1.8-20 .3z" fill="${roupa}"/><path d="M19 25h26" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>`,
  } as Record<string, string>)[pen] ?? '';
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><clipPath id="${id}c"><circle cx="32" cy="32" r="32"/></clipPath></defs>`
    + `<g clip-path="url(#${id}c)"><rect width="64" height="64" fill="url(#${id})"/>${costas}`
    + `<path d="M8 66c0-13 10.5-21 24-21s24 8 24 21z" fill="${roupa}"/><path d="M26 45.5l6 6 6-6" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<path d="M27 37h10v8c0 3-10 3-10 0z" fill="${pele}"/><path d="M27 40c3 2 7 2 10 0v-3H27z" fill="rgba(0,0,0,.14)"/>`
    + `<circle cx="20" cy="29.5" r="3.3" fill="${pele}"/><circle cx="44" cy="29.5" r="3.3" fill="${pele}"/><ellipse cx="32" cy="28" rx="12.3" ry="13.4" fill="${pele}"/>`
    + (tem('barba') ? `<path d="M19.8 29c.6 10 5.5 15.5 12.2 15.5S43.6 39 44.2 29c-1.8 5.5-4.6 6.5-6.2 6.5-1.4-1.8-3.6-2.4-6-2.4s-4.6.6-6 2.4c-1.6 0-4.4-1-6.2-6.5z" fill="${cab}"/>` : '')
    + `<circle cx="24.6" cy="33.2" r="2.3" fill="#FF7A6B" opacity=".32"/><circle cx="39.4" cy="33.2" r="2.3" fill="#FF7A6B" opacity=".32"/>`
    + `<path d="M24.8 24.6q2.2-1.4 4.4 0M34.8 24.6q2.2-1.4 4.4 0" fill="none" stroke="${pen === 'careca' ? 'rgba(0,0,0,.45)' : cab}" stroke-width="1.5" stroke-linecap="round"/>`
    + `<circle cx="27" cy="29" r="1.9" fill="#26201C"/><circle cx="37" cy="29" r="1.9" fill="#26201C"/><circle cx="27.6" cy="28.4" r=".6" fill="#fff"/><circle cx="37.6" cy="28.4" r=".6" fill="#fff"/>`
    + `<path d="M28.6 34.6q3.4 3.2 6.8 0" fill="none" stroke="#7A2E22" stroke-width="1.6" stroke-linecap="round"/>${frente}`
    + (tem('oculos') ? `<g fill="rgba(255,255,255,.18)" stroke="#1F2937" stroke-width="1.3"><circle cx="27" cy="29" r="4"/><circle cx="37" cy="29" r="4"/></g><path d="M31 29h2M23 28.5l-3-1M41 28.5l3-1" stroke="#1F2937" stroke-width="1.3" stroke-linecap="round"/>` : '')
    + (tem('fone') ? `<path d="M18.5 30c-1-12 6-18.5 13.5-18.5S46.5 18 45.5 30" fill="none" stroke="#1F2937" stroke-width="2.4" stroke-linecap="round"/><rect x="15.5" y="26" width="5.5" height="8.5" rx="2.4" fill="#1F2937"/><rect x="43" y="26" width="5.5" height="8.5" rx="2.4" fill="#1F2937"/>` : '')
    + (tem('capacete') ? `<path d="M18.5 24C18.5 14 25 9.5 32 9.5S45.5 14 45.5 24z" fill="#FACC15"/><path d="M16 24.2h32c1 0 1 2.4 0 2.4H16c-1 0-1-2.4 0-2.4z" fill="#EAB308"/>` : '')
    + (tem('fita') ? `<path d="M19 47c4 5 7 9 9 17M45 47c-4 5-7 9-9 17" fill="none" stroke="#FACC15" stroke-width="3.4"/>` : '')
    + `</g></svg>`;
}

/** Avatar redondo: personagem escolhido ou as iniciais do nome. */
export function Avatar({ nome, avatar, tamanho = 36 }: { nome: string; avatar: number | null; tamanho?: number }) {
  const uid = useId().replace(/:/g, '');
  const st = { width: tamanho, height: tamanho, fontSize: tamanho * 0.38 };
  if (avatar !== null) return <span className="av avchar" style={st} aria-hidden="true" dangerouslySetInnerHTML={{ __html: avatarSvg(avatar, uid) }} />;
  return <span className="av" style={st} aria-hidden="true">{iniciais(nome)}</span>;
}

/** Janela "Meu perfil": nome e galeria de avatares. */
export function JanelaPerfil({ perfil, mudar, fechar }: { perfil: Perfil; mudar: (p: Partial<Perfil>) => void; fechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog className="janela" ref={ref} onClose={fechar} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} aria-label="Meu perfil">
      <form method="dialog">
        <header><h2>Meu perfil</h2><button type="button" className="fechar" aria-label="Fechar" onClick={() => ref.current?.close()}>×</button></header>
        <div className="janela-corpo">
          <label>Seu nome<input value={perfil.nome} maxLength={40} onChange={(e) => mudar({ nome: e.target.value })} /></label>
          <p className="suave" style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 13 }}>Avatar</p>
          <div className="avgal">
            <button type="button" className={`avopt${perfil.avatar === null ? ' on' : ''}`} aria-label="Usar as iniciais" onClick={() => mudar({ avatar: null })}><Avatar nome={perfil.nome} avatar={null} tamanho={48} /></button>
            {AVATARES.map((_, i) => (
              <button type="button" key={i} className={`avopt${perfil.avatar === i ? ' on' : ''}`} aria-label={`Avatar ${i + 1}`} aria-pressed={perfil.avatar === i} onClick={() => mudar({ avatar: i })}>
                <Avatar nome={perfil.nome} avatar={i} tamanho={48} />
              </button>
            ))}
          </div>
          <p className="suave" style={{ fontSize: 12 }}>Fica salvo só neste navegador. Quando houver login, vem da sua conta.</p>
        </div>
        <footer><button className="btn" type="submit">Fechar</button></footer>
      </form>
    </dialog>
  );
}
