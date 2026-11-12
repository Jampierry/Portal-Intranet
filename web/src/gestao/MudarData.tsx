import { useState } from 'react';
import { api } from '../api';
import { avisar } from '../Confirmar';
import { dataCurta } from '../dados';
import { JanelaForm } from './Crud';

/** Mudar a data de publicação de algo já publicado/aprovado. Quem precisa de aprovação do RH volta para a fila com a data nova. */
export function MudarData({ item, dataAtual, url, campo, exigeAprovacao, aoFechar, aoConcluir }: {
  /** Texto que identifica o item (ex.: título). */ item: string; dataAtual: string | null; /** Endereço que recebe a nova data. */ url: string;
  /** Nome do campo da data no envio (ex.: exibir_de). */ campo: string; exigeAprovacao: boolean; aoFechar: () => void; aoConcluir: () => void;
}) {
  const [data, setData] = useState(dataAtual ?? '');
  return (
    <JanelaForm titulo="Mudar a data de publicação" rotuloEnviar={exigeAprovacao ? 'Mudar e reenviar ao RH' : 'Mudar a data'} aoFechar={aoFechar}
      aoEnviar={async () => {
        await api(url, { [campo]: data });
        aoConcluir();
        if (exigeAprovacao) await avisar({ titulo: 'Enviada de novo para aprovação', mensagem: 'A data mudou e o RH foi avisado para aprovar de novo. Até lá, o conteúdo sai do ar. Você recebe o retorno no sino e por aviso no aparelho.' });
      }}>
      <p style={{ marginTop: 0 }}>«<b>{item}</b>»{dataAtual ? ` · data atual: ${dataCurta(dataAtual)}` : ''}</p>
      <label>Nova data de publicação *<input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></label>
      {exigeAprovacao ? <p className="suave">Como você precisa de aprovação, o conteúdo volta para a fila do RH com a data nova.</p> : <p className="suave">O conteúdo passa a aparecer a partir desta data.</p>}
    </JanelaForm>
  );
}
