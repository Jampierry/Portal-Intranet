import { Icone, IconeSistema } from './icones';

export type Tela = 'inicio' | 'comunicados' | 'aplicacoes' | 'documentos';

// Item: [id, nome, ativo]. Só os "ativos" têm tela; os demais aparecem apagados ("em breve").
type Item = [string, string, boolean];
const ITENS: Item[] = [
  ['inicio', 'Início', true], ['comunicados', 'Comunicados', true], ['aplicacoes', 'Aplicações', true], ['documentos', 'Documentos', true],
  ['pessoas', 'Pessoas', false], ['ajuda', 'Ajuda', false],
];

interface Props { tela: Tela; irPara: (t: Tela) => void; recolhido: boolean; alternar: () => void; gavetaAberta: boolean; fecharGaveta: () => void }

/** Menu lateral esquerdo. O botão de recolher fica no topo da própria barra, ao lado da marca. */
export function Menu(p: Props) {
  const mini = p.recolhido;
  return (
    <aside className={`menu${mini ? ' mini' : ''}${p.gavetaAberta ? ' aberto' : ''}`} aria-label="Menu">
      <div className="sbtop">
        <button className="appbtn" onClick={p.alternar} aria-expanded={!mini} aria-label={mini ? 'Expandir menu' : 'Recolher menu'} title={mini ? 'Expandir menu' : 'Recolher menu'}>
          <IconeSistema tamanho={30} />
        </button>
        <div className="brandtxt"><span className="empnome">Di Paula</span><span>INTRANET</span></div>
      </div>
      <nav aria-label="Seções do portal">
        {ITENS.map(([id, nome, ativo]) => (
          <button key={id} className={`nitem${ativo ? '' : ' breve'}`} title={ativo ? nome : `${nome} — em breve`}
            aria-label={mini ? nome : undefined} aria-current={ativo && p.tela === id ? 'page' : undefined} aria-disabled={ativo ? undefined : true}
            onClick={() => { if (ativo) { p.fecharGaveta(); p.irPara(id as Tela); } }}>
            <Icone nome={id} /><span className="lbl">{nome}</span>{!ativo && !mini && <small>em breve</small>}
          </button>
        ))}
      </nav>
      <div className="sbfoot"><span className="menu-rodape">MODA QUE PRODUZ</span></div>
    </aside>
  );
}
