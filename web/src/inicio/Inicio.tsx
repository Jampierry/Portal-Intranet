import { useLista, type Comunicado } from '../dados';
import { ListaComunicados } from '../comunicados/Comunicados';
import { Destaques } from './Destaques';
import type { Tela } from '../Menu';

export function Inicio({ irPara }: { irPara: (t: Tela) => void }) {
  const { dados } = useLista<Comunicado>('/api/comunicados');
  return (
    <>
      <section className="destaque">
        <h2>Comunicados para acompanhar o que importa.</h2>
        <p>Avisos, aplicações e reconhecimento da equipe em um só lugar. Conteúdo de demonstração.</p>
        <button className="btn btn-acento" onClick={() => irPara('comunicados')}>Ver comunicados</button>
      </section>
      <section>
        <div className="barra">
          <h2>Comunicados recentes</h2>
          <button className="btn btn-sec btn-pequeno" onClick={() => irPara('comunicados')}>Ver todos</button>
        </div>
        {dados === null ? <p className="vazio">Carregando…</p> : <ListaComunicados itens={dados.slice(0, 3)} />}
      </section>
      <Destaques />
    </>
  );
}
