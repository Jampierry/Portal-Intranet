import { Icone } from '../icones';

/** Quadro "formato ideal" ao lado das prévias: tamanho e padrão de imagem e vídeo que melhor se encaixam no lugar. */
export function FormatoIdeal({ titulo = 'Formato ideal', itens }: { titulo?: string; itens: { rotulo: string; texto: string }[] }) {
  return (
    <div className="pv-formato" role="note">
      <h4><Icone nome="ajuda" tamanho={15} /> {titulo}</h4>
      <dl>{itens.map((i) => <div key={i.rotulo}><dt>{i.rotulo}</dt><dd>{i.texto}</dd></div>)}</dl>
    </div>
  );
}
