import { useEffect, useState } from 'react';
import { Icone } from './icones';
import { LogoNome, useEmpresa } from './empresa';
import { Calendario } from './Calendario';
import { isoDe } from './calendarioTipos';

export type Tela = 'inicio' | 'comunicados' | 'documentos' | 'publicar' | 'configuracoes' | 'calendario' | 'pesquisas' | 'pessoas' | 'ajuda' | 'perfil';

// Item: [id, nome]. Publicar aparece para editor e administrador; Configurações, só para o administrador.
type Item = [Tela, string];
const ITENS: Item[] = [['inicio', 'Início'], ['comunicados', 'Comunicados'], ['documentos', 'Documentos'], ['calendario', 'Calendário'], ['pesquisas', 'Pesquisas'], ['pessoas', 'Contatos'], ['ajuda', 'Ajuda']];

const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
/** Menu recolhido: o dia e a hora de agora num quadradinho (mês em cima, dia, hora). Clicar abre o Calendário já no dia de hoje. A hora se atualiza sozinha. */
function DiaMini({ abrir }: { abrir: (iso: string) => void }) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 15_000); return () => clearInterval(t); }, []);
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  const iso = isoDe(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const rotulo = `Hoje, ${DIAS_LONGOS[agora.getDay()]}, ${agora.getDate()} de ${MESES_CURTOS[agora.getMonth()].toLowerCase()}, ${hora}. Abrir o calendário`;
  return (
    <button type="button" className="dia-mini" onClick={() => abrir(iso)} title={rotulo} aria-label={rotulo}>
      <span className="dia-mini-mes">{MESES_CURTOS[agora.getMonth()]}</span>
      <b>{agora.getDate()}</b>
      <time className="dia-mini-hora" dateTime={hora}>{hora}</time>
    </button>
  );
}

interface Props {
  tela: Tela; irPara: (t: Tela, slug?: string) => void; recolhido: boolean; alternar: () => void; gavetaAberta: boolean; fecharGaveta: () => void;
  mostrarPublicar: boolean; mostrarConfig: boolean; mostrarCalendario?: boolean; podeCriarData?: boolean; podeExcluirData?: boolean;
  /** Telas liberadas para o usuário (Início é sempre liberado). */
  telasLiberadas: Tela[];
}

/** Menu lateral esquerdo: marca e navegação. Os aplicativos ficam na barra da direita; o cadastro deles, em Publicar › Aplicativos. */
export function Menu(p: Props) {
  const empresa = useEmpresa();
  const mini = p.recolhido;
  const itens: Item[] = [...ITENS.slice(0, 5).filter(([id]) => id === 'inicio' || id === 'pesquisas' || p.telasLiberadas.includes(id)), ...(p.mostrarPublicar ? ([['publicar', 'Publicar']] as Item[]) : []), ...ITENS.slice(5).filter(([id]) => p.telasLiberadas.includes(id)), ...(p.mostrarConfig ? ([['configuracoes', 'Configurações']] as Item[]) : [])];
  return (
    <aside className={`menu${mini ? ' mini' : ''}${p.gavetaAberta ? ' aberto' : ''}`} aria-label="Menu">
      <div className="sbtop">
        <div className="brandtxt">{(empresa.logo_nome || empresa.logo_nome_escuro) ? <LogoNome classe="empnome-img" sobre="menu" /> : <span className="empnome">{empresa.nome}</span>}{empresa.slogan && <span>{empresa.slogan}</span>}</div>
        <button className="menubtn" onClick={p.alternar} aria-expanded={!mini} aria-label={mini ? 'Expandir menu' : 'Recolher menu'} title={mini ? 'Expandir menu' : 'Recolher menu'}>
          <Icone nome="menu" tamanho={20} />
        </button>
      </div>

      <nav aria-label="Seções do portal">
        {!mini && <span className="menu-label">ESPAÇO DE TRABALHO</span>}
        {itens.map(([id, nome]) => (
          <button key={id} className="nitem" title={nome} aria-label={mini ? nome : undefined} aria-current={p.tela === id ? 'page' : undefined}
            onClick={() => { p.fecharGaveta(); p.irPara(id); }}>
            <Icone nome={id} /><span className="lbl">{nome}</span>
          </button>
        ))}
      </nav>

      {mini && p.mostrarCalendario !== false && <DiaMini abrir={(dia) => { p.fecharGaveta(); p.irPara('calendario', dia); }} />}

      {!mini && p.mostrarCalendario !== false && <Calendario podeCriar={p.podeCriarData} podeExcluir={p.podeExcluirData} abrirCalendario={(dia) => { p.fecharGaveta(); p.irPara('calendario', dia); }} />}

      {!mini && <div className="sbfoot"><span className="menu-rodape">JUNTOS<br />VAMOS MAIS LONGE</span></div>}
    </aside>
  );
}
