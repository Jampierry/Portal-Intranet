import type { ReactNode } from 'react';
import { Cabecalho } from '../Cabecalho';
import { Icone } from '../icones';

const TOPICOS: { titulo: string; icone: string; corpo: ReactNode }[] = [
  {
    titulo: 'Como entro no portal e troco minha senha?', icone: 'chave',
    corpo: <>
      <p>Use o login e a senha que o administrador do portal criou para você. No primeiro acesso a senha é provisória: o portal pede que você crie uma senha só sua.</p>
      <p>Para trocar depois, clique no seu avatar (canto superior direito) › <b>Minha conta</b> › <b>Trocar senha</b>. Use no mínimo 8 caracteres.</p>
    </>,
  },
  {
    titulo: 'Esqueci a senha ou o login foi bloqueado', icone: 'info',
    corpo: <>
      <p>Depois de 5 tentativas erradas o login fica bloqueado por 15 minutos. Passado esse tempo, tente de novo.</p>
      <p>Se esqueceu a senha, peça ao administrador do portal para redefinir. Você receberá uma senha provisória e criará a nova no próximo acesso.</p>
    </>,
  },
  {
    titulo: 'Como abro e favorito aplicativos?', icone: 'apps',
    corpo: <>
      <p>Clique no ícone de grade, na barra da direita (no celular, em <b>Aplicativos</b> no rodapé ou no topo). Ela abre a lista dos seus favoritos e de todos os aplicativos; clique em um nome para abrir.</p>
      <p>No computador o aplicativo abre em uma nova aba e o portal continua aberto. No celular ele abre na mesma aba: use o botão <b>Voltar</b> do navegador para retornar ao portal.</p>
      <p>Use a estrela para favoritar. Os favoritos ficam salvos na sua conta e aparecem como ícones na barra da direita.</p>
    </>,
  },
  {
    titulo: 'Onde encontro comunicados e documentos?', icone: 'comunicados',
    corpo: <>
      <p>Os avisos ficam em <b>Comunicados</b>. Os urgentes também aparecem no sino da barra superior e em “Avisos importantes” no Início.</p>
      <p>Em <b>Documentos</b> cada item mostra versão, responsável e data de revisão. O arquivo fica no sistema de origem: abra pelo <b>link oficial</b> do documento, assim você sempre usa a versão vigente.</p>
    </>,
  },
  {
    titulo: 'Com quem falo sobre cada assunto?', icone: 'pessoas',
    corpo: <p>Veja a tela <b>Pessoas</b>: ela lista o canal de cada área (e-mail, ramal ou ferramenta de chamados). Se não achar a área, use a busca no topo.</p>,
  },
  {
    titulo: 'O que cada perfil pode fazer?', icone: 'gestao',
    corpo: <ul>
      <li><b>Consulta:</b> lê comunicados, documentos, aplicações e contatos.</li>
      <li><b>Editor:</b> também publica comunicados, documentos, contatos e colaborador destaque pela tela <b>Publicar</b>, onde fica o catálogo de aplicativos.</li>
      <li><b>Administrador:</b> tudo isso, mais usuários, perfis e a auditoria (registro de quem alterou o quê) na tela <b>Configurações</b>, além do cadastro de aplicativos.</li>
    </ul>,
  },
  {
    titulo: 'Como funciona o reconhecimento “Colaborador Destaque”?', icone: 'estrela',
    corpo: <p>É um reconhecimento sem ranking nem pontuação. Uma pessoa só aparece depois de aprovada, com o consentimento dela registrado. Se não quiser aparecer, fale com o editor responsável.</p>,
  },
];

export function Ajuda({ irPara }: { irPara: (t: 'pessoas') => void }) {
  return (
    <>
      <Cabecalho titulo="Ajuda" sub="Respostas rápidas para usar o portal." />
      <div className="faq">
        {TOPICOS.map((t, i) => (
          <details key={t.titulo} open={i === 0}>
            <summary><span className="mini-ico"><Icone nome={t.icone} tamanho={18} /></span>{t.titulo}<Icone nome="chev" tamanho={16} classe="seta-faq" /></summary>
            <div className="faq-corpo">{t.corpo}</div>
          </details>
        ))}
      </div>
      <p className="suave">Não achou o que procurava? <button className="link-ver" onClick={() => irPara('pessoas')}>Veja os contatos por área <Icone nome="seta" tamanho={15} /></button></p>
    </>
  );
}
