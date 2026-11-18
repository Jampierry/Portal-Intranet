import { Icone } from './icones';

/** "×" discreto dentro da barra de pesquisa: limpa o texto digitado e devolve o foco ao campo. Só aparece com texto. */
export function BotaoLimpar({ aoLimpar }: { aoLimpar: () => void }) {
  return (
    <button type="button" className="busca-limpar" aria-label="Limpar pesquisa" title="Limpar pesquisa"
      onClick={(e) => { const campo = e.currentTarget.parentElement?.querySelector('input'); aoLimpar(); campo?.focus(); }}>
      <Icone nome="fechar" tamanho={12} />
    </button>
  );
}
