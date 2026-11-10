import { useState, type ReactNode } from 'react';
import { Icone } from '../icones';

const GRUPOS = ['Todos', 'Acesso', 'Usar o portal', 'Regras'] as const;
type Grupo = Exclude<(typeof GRUPOS)[number], 'Todos'>;
const TOPICOS: { grupo: Grupo; titulo: string; icone: string; corpo: ReactNode }[] = [
  {
    grupo: 'Acesso', titulo: 'Como entro no portal e troco minha senha?', icone: 'chave',
    corpo: <>
      <p>Use o login e a senha que o administrador do portal criou para você. No primeiro acesso a senha é provisória: o portal pede que você crie uma senha só sua.</p>
      <p>Para trocar depois, clique no seu avatar (canto superior direito) › <b>Minha conta</b> › <b>Trocar senha</b>. Use no mínimo 8 caracteres.</p>
    </>,
  },
  {
    grupo: 'Acesso', titulo: 'Esqueci a senha ou o login foi bloqueado', icone: 'info',
    corpo: <>
      <p>Depois de 5 tentativas erradas o login fica bloqueado por 15 minutos. Passado esse tempo, tente de novo.</p>
      <p>Se esqueceu a senha, peça ao administrador do portal para redefinir. Você receberá uma senha provisória e criará a nova no próximo acesso.</p>
    </>,
  },
  {
    grupo: 'Usar o portal', titulo: 'Como abro e favorito aplicativos?', icone: 'apps',
    corpo: <>
      <p>Clique no ícone de grade, na barra da direita (no celular, em <b>Aplicativos</b> no rodapé ou no topo). Ela abre a lista dos seus favoritos e de todos os aplicativos; clique em um nome para abrir.</p>
      <p>No computador o aplicativo abre em uma nova aba e o portal continua aberto. No celular ele abre na mesma aba: use o botão <b>Voltar</b> do navegador para retornar ao portal.</p>
      <p>Use a estrela para favoritar. Os favoritos ficam salvos na sua conta e aparecem como ícones na barra da direita.</p>
    </>,
  },
  {
    grupo: 'Usar o portal', titulo: 'Onde encontro comunicados e documentos?', icone: 'comunicados',
    corpo: <>
      <p>Os avisos ficam em <b>Comunicados</b>. Os urgentes também aparecem no sino da barra superior e em “Avisos importantes” no Início.</p>
      <p>Em <b>Documentos</b> cada item mostra versão, responsável e data de revisão. O arquivo fica no sistema de origem: abra pelo <b>link oficial</b> do documento, assim você sempre usa a versão vigente.</p>
    </>,
  },
  {
    grupo: 'Usar o portal', titulo: 'Com quem falo sobre cada assunto?', icone: 'pessoas',
    corpo: <p>Veja a tela <b>Contatos</b>: ela lista o canal de cada área (e-mail, ramal ou ferramenta de chamados). Se não achar a área, use a busca no topo.</p>,
  },
  {
    grupo: 'Regras', titulo: 'O que cada perfil pode fazer?', icone: 'gestao',
    corpo: <ul>
      <li><b>Consulta:</b> lê comunicados, documentos, aplicações e contatos.</li>
      <li><b>Editor:</b> também publica comunicados, documentos, contatos e colaborador destaque pela tela <b>Publicar</b>, onde fica o catálogo de aplicativos.</li>
      <li><b>Administrador:</b> tudo isso, mais usuários, perfis e a auditoria (registro de quem alterou o quê) na tela <b>Configurações</b>, além do cadastro de aplicativos.</li>
    </ul>,
  },
  {
    grupo: 'Regras', titulo: 'Como funciona o reconhecimento “Colaborador Destaque”?', icone: 'estrela',
    corpo: <p>É um reconhecimento sem ranking nem pontuação. Uma pessoa só aparece depois de aprovada, com o consentimento dela registrado. Se não quiser aparecer, fale com o editor responsável.</p>,
  },
];

export function Ajuda({ irPara }: { irPara: (t: 'pessoas') => void }) {
  const [grupo, setGrupo] = useState<(typeof GRUPOS)[number]>('Todos');
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState<string | null>(TOPICOS[0].titulo);
  const termo = q.trim().toLocaleLowerCase('pt-BR');
  const lista = TOPICOS.filter((t) => (grupo === 'Todos' || t.grupo === grupo) && (!termo || t.titulo.toLocaleLowerCase('pt-BR').includes(termo)));
  return (
    <>
      <label className="busca-pagina">
        <Icone nome="busca" tamanho={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nas perguntas" aria-label="Buscar na ajuda" />
      </label>
      <div className="barra">
        <div className="pilulas filtros" role="group" aria-label="Filtrar por assunto">
          {GRUPOS.map((g) => <button key={g} aria-pressed={grupo === g} onClick={() => setGrupo(g)}>{g}</button>)}
        </div>
        <span className="suave" aria-live="polite">{lista.length} {lista.length === 1 ? 'pergunta' : 'perguntas'}</span>
      </div>
      {lista.length === 0 && <p className="vazio">Nenhuma pergunta encontrada. <button className="btn btn-sec btn-pequeno" onClick={() => { setQ(''); setGrupo('Todos'); }}>Limpar busca e filtros</button></p>}
      <div className="faq">
        {lista.map((t) => (
          <details key={t.titulo} open={aberto === t.titulo} onToggle={(e) => { const ab = (e.currentTarget as HTMLDetailsElement).open; setAberto((atual) => ab ? t.titulo : atual === t.titulo ? null : atual); }}>
            <summary><span className="mini-ico"><Icone nome={t.icone} tamanho={18} /></span>{t.titulo}<Icone nome="chev" tamanho={16} classe="seta-faq" /></summary>
            <div className="faq-corpo">{t.corpo}</div>
          </details>
        ))}
      </div>
      <p className="suave">Não achou o que procurava? <button className="link-ver" onClick={() => irPara('pessoas')}>Veja os contatos por área <Icone nome="seta" tamanho={15} /></button></p>
    </>
  );
}
