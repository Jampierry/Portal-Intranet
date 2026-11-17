import { Icone } from '../icones';
import { Dica } from '../Dica';
import { ehVideo, VideoFundo } from '../midia';

const POSICOES: { id: string; nome: string; razao: string }[] = [
  { id: 'principal', nome: 'Esquerda', razao: '1000 / 330' },
  { id: 'lateral1', nome: 'Meio', razao: '700 / 330' },
  { id: 'lateral2', nome: 'Direita', razao: '700 / 330' },
];

const t = (v: unknown) => String(v ?? '').trim();

/** Prévia ao vivo do banner (mesmo visual do carrossel do Início) enquanto o formulário é preenchido. */
export function PreviaBanner({ v }: { v: Record<string, string | boolean | object> }) {
  const posicao = t(v.posicao) || 'principal';
  const menor = posicao !== 'principal';
  const titulo = t(v.titulo), subtitulo = t(v.subtitulo), imagem = t(v.imagem), botao = t(v.botao_texto), link = t(v.link);
  const razao = POSICOES.find((p) => p.id === posicao)?.razao ?? '1000 / 330';
  const mostraBotao = !!link && !!botao;
  const avisos: string[] = [];
  if (link && !botao) avisos.push('Falta o texto do botão: sem ele o botão não aparece.');
  if (!imagem) avisos.push('Sem imagem ou vídeo: o fundo usa a cor do tema.');
  if (!menor && !subtitulo) avisos.push('O subtítulo aparece só no carrossel da esquerda.');

  return (
    <div className="pv">
      <h3 className="pv-titulo">Prévia do banner</h3>
      <div className="pv-banner" style={{ aspectRatio: razao }}>
        <section className={`hero novidades${menor ? ' menor' : ''}`} aria-label="Prévia do banner">
          <div className="slide ativo">
            {imagem
              ? (ehVideo(imagem) ? <VideoFundo className="slide-fundo" src={imagem} /> : <img className="slide-fundo" src={imagem} alt="" />)
              : <span className="slide-fundo slide-cor" />}
            <span className="slide-veu" />
            <div className="slide-texto">
              {!menor && <small className="eyebrow">NOVIDADES DA SEMANA</small>}
              <h2>{titulo || 'Título do banner'}</h2>
              {!menor && subtitulo && <p>{subtitulo}</p>}
              {mostraBotao && <span className="btn btn-coral">{botao} <Icone nome="seta" tamanho={16} /></span>}
            </div>
          </div>
        </section>
      </div>
      <p className="pv-legenda">Carrossel da {POSICOES.find((p) => p.id === posicao)?.nome.toLowerCase()} · tamanho real aproximado {menor ? '700 × 330' : '1000 × 330'} px</p>

      <h3 className="pv-titulo pv-com-dica">Lugar no Início <Dica lado="dir">Os três carrosséis ficam lado a lado no topo do Início e giram juntos.</Dica></h3>
      <div className="pv-mapa" aria-hidden="true">
        {POSICOES.map((p) => <span key={p.id} className={p.id === posicao ? 'pv-mapa-ativo' : undefined}>{p.nome}</span>)}
      </div>

      {avisos.length > 0 && <ul className="pv-avisos">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
    </div>
  );
}
