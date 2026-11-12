import { useEffect, useRef, type ReactNode } from 'react';
import { dataCurta } from '../dados';
import { ListaAnexos, type Anexo } from './Anexos';

type Dados = Record<string, unknown> & { anexos?: Anexo[] };
type Linha = [rotulo: string, chave: string, formatar?: (v: unknown, d: Dados) => ReactNode];

const ROTULO_POSICAO: Record<string, string> = { principal: 'Carrossel da esquerda (maior)', lateral1: 'Carrossel do meio', lateral2: 'Carrossel da direita' };
const ROTULO_ACESSO: Record<string, string> = { interno: 'Todos os logados', publico: 'Público (interno, sem restrição)', restrito: 'Restrito (editores e admin)' };
const ROTULO_ORIGEM: Record<string, string> = { link: 'Link na internet / sistema', pasta: 'Arquivo na pasta de documentos do portal', servidor: 'Pasta do servidor', rede: 'Pasta de rede (antigo)' };
const ROTULO_PLATAFORMA: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp', outra: 'Outra plataforma' };
const data = (v: unknown) => dataCurta(String(v));
const simNao = (v: unknown) => (v ? 'Sim' : 'Não');
const mapa = (m: Record<string, string>) => (v: unknown) => m[String(v)] ?? String(v);

/** Campos de cada tipo de publicação, na ordem do formulário de cadastro. */
const CAMPOS: Record<string, Linha[]> = {
  comunicado: [['Título', 'titulo'], ['Categoria', 'categoria'], ['Prioridade', 'prioridade', mapa({ normal: 'Normal', urgente: 'Urgente' })], ['Resumo', 'resumo'], ['Texto', 'corpo'], ['Exibir a partir de', 'exibir_de', data], ['Exibir até', 'exibir_ate', data], ['Exige confirmação de leitura', 'exige_leitura', simNao]],
  banner: [['Título', 'titulo'], ['Subtítulo', 'subtitulo'], ['Em qual carrossel aparece', 'posicao', mapa(ROTULO_POSICAO)], ['Ordem', 'ordem'], ['Texto do botão', 'botao_texto'], ['Link do botão', 'link'], ['Exibir a partir de', 'exibir_de', data], ['Exibir até', 'exibir_ate', data]],
  documento: [['Título', 'titulo'], ['Resumo', 'resumo'], ['Categoria', 'categoria'], ['Formato', 'formato'], ['Versão', 'versao'], ['Responsável', 'responsavel'], ['Quem pode ver', 'classificacao', mapa(ROTULO_ACESSO)], ['Revisado em', 'revisado_em', data], ['Publicar a partir de', 'exibir_de', data], ['Onde está o documento', 'origem', mapa(ROTULO_ORIGEM)], ['Endereço do documento', 'link_oficial']],
  rede_social: [['Plataforma', 'plataforma', mapa(ROTULO_PLATAFORMA)], ['Título (uso interno)', 'titulo'], ['Data prevista', 'data_prevista', data], ['Legenda / texto da publicação', 'legenda'], ['Link a divulgar', 'link']],
};

/** Página de leitura da publicação enviada para aprovação: os mesmos campos do cadastro, sem poder editar. */
export function DetalhePedido({ titulo, tipo, dados, remetente, aoFechar, acoes }: { titulo: string; tipo: string; dados: Dados; remetente: string; aoFechar: () => void; acoes?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const campos = (CAMPOS[tipo] ?? []).filter(([, k]) => dados[k] !== null && dados[k] !== undefined && dados[k] !== '');
  const imagem = typeof dados.imagem === 'string' && dados.imagem ? dados.imagem : null;
  return (
    <dialog ref={ref} className="janela janela-larga" aria-label={`Publicação ${titulo}`} onCancel={(e) => { e.preventDefault(); aoFechar(); }} onClick={(e) => { if (e.target === ref.current) aoFechar(); }}>
      <div className="janela-form">
        <header><h2>{titulo}</h2></header>
        <div className="janela-corpo detalhe-pedido">
          <p className="suave detalhe-aviso">Somente leitura · enviado por {remetente}</p>
          {imagem && <img className="detalhe-imagem" src={imagem} alt="Imagem da publicação" />}
          <dl>
            {campos.map(([rotulo, chave, formatar]) => (
              <div key={chave}>
                <dt>{rotulo}</dt>
                <dd>{formatar ? formatar(dados[chave], dados) : String(dados[chave])}</dd>
              </div>
            ))}
          </dl>
          {!!dados.anexos?.length && <div><h3 className="detalhe-sub">Arquivos anexados</h3><ListaAnexos anexos={dados.anexos} /></div>}
        </div>
        <footer>
          {acoes}
          <button type="button" className="btn btn-sec" onClick={aoFechar} autoFocus>Fechar</button>
        </footer>
      </div>
    </dialog>
  );
}
