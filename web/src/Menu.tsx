import { Icone, IconeSistema } from './icones';
import { Calendario } from './Calendario';

export type Tela = 'inicio' | 'comunicados' | 'documentos' | 'publicar' | 'configuracoes' | 'pessoas' | 'ajuda';

// Item: [id, nome]. Publicar aparece para editor e administrador; Configurações, só para o administrador.
type Item = [Tela, string];
const ITENS: Item[] = [['inicio', 'Início'], ['comunicados', 'Comunicados'], ['documentos', 'Documentos'], ['pessoas', 'Pessoas'], ['ajuda', 'Ajuda']];

interface Props {
  tela: Tela; irPara: (t: Tela, slug?: string) => void; recolhido: boolean; alternar: () => void; gavetaAberta: boolean; fecharGaveta: () => void;
  mostrarPublicar: boolean; mostrarConfig: boolean;
  /** Telas liberadas para o usuário (Início é sempre liberado). */
  telasLiberadas: Tela[];
}

/** Menu lateral esquerdo: marca e navegação. Os aplicativos ficam na barra da direita; o cadastro deles, em Publicar › Aplicativos. */
export function Menu(p: Props) {
  const mini = p.recolhido;
  const itens: Item[] = [...ITENS.slice(0, 3).filter(([id]) => id === 'inicio' || p.telasLiberadas.includes(id)), ...(p.mostrarPublicar ? ([['publicar', 'Publicar']] as Item[]) : []), ...ITENS.slice(3).filter(([id]) => p.telasLiberadas.includes(id)), ...(p.mostrarConfig ? ([['configuracoes', 'Configurações']] as Item[]) : [])];
  return (
    <aside className={`menu${mini ? ' mini' : ''}${p.gavetaAberta ? ' aberto' : ''}`} aria-label="Menu">
      <div className="sbtop">
        <button className="appbtn" onClick={p.alternar} aria-expanded={!mini} aria-label={mini ? 'Expandir menu' : 'Recolher menu'} title={mini ? 'Expandir menu' : 'Recolher menu'}>
          <IconeSistema tamanho={30} />
        </button>
        <div className="brandtxt"><span className="empnome">Di Paula</span><span>MODA EM MOVIMENTO</span></div>
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

      {!mini && <Calendario />}

      {!mini && <div className="sbfoot"><span className="menu-rodape">JUNTOS<br />VAMOS MAIS LONGE</span></div>}
    </aside>
  );
}
