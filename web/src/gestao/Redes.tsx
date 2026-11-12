import { useState } from 'react';
import { api } from '../api';
import { avisar } from '../Confirmar';
import { Crud, JanelaForm, Selo, usePermissoes } from './Crud';
import { dataCurta } from '../dados';

export const PLATAFORMAS: [string, string][] = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['whatsapp', 'WhatsApp'], ['outra', 'Outra plataforma']];
const nomeDe = (p: string) => PLATAFORMAS.find(([v]) => v === p)?.[1] ?? p;

interface Rede { id: number; plataforma: string; titulo: string; legenda: string | null; imagem: string | null; link: string | null; data_prevista: string | null; status: string; motivo: string | null; link_publicado: string | null; publicada_em: string | null; autor: string | null }
const SIT: Record<string, ['ok' | 'aviso' | 'neutro' | 'erro', string]> = {
  rascunho: ['neutro', 'Rascunho'], em_aprovacao: ['aviso', 'Aguardando o RH'], aprovada: ['ok', 'Aprovada: pode publicar'], rejeitada: ['erro', 'Rejeitada'], publicada: ['ok', 'Publicada'],
};
const s = (v: string | null) => v ?? '';

/** Janela "Marcar como publicada": registra o link do post depois que a equipe publicou na plataforma. */
function JanelaPublicada({ r, aoFechar, aoConcluir }: { r: Rede; aoFechar: () => void; aoConcluir: () => void }) {
  const [link, setLink] = useState('');
  return (
    <JanelaForm titulo="Marcar como publicada" rotuloEnviar="Marcar como publicada" aoFechar={aoFechar}
      aoEnviar={async () => { await api(`/api/gestao/redes/${r.id}/publicada`, { link_publicado: link }); aoConcluir(); }}>
      <p style={{ marginTop: 0 }}>Use depois de publicar «<b>{r.titulo}</b>» no {nomeDe(r.plataforma)}.</p>
      <label>Link da publicação (opcional)<input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/p/..." maxLength={500} /></label>
    </JanelaForm>
  );
}

/** Publicar › Redes sociais: registra o que vai para Instagram e outras plataformas e envia para a aprovação do RH. */
export function RedesSociais({ exigeAprovacao }: { exigeAprovacao: boolean }) {
  const perms = usePermissoes();
  const podeEditar = perms === null || perms.includes('pub.redes.editar');
  const [publicando, setPublicando] = useState<{ r: Rede; recarregar: () => void } | null>(null);
  const enviar = async (r: Rede, recarregar: () => void) => {
    try {
      const novo = await api<Rede>(`/api/gestao/redes/${r.id}/enviar`, {});
      recarregar();
      await avisar({ titulo: novo.status === 'em_aprovacao' ? 'Enviada para aprovação' : 'Publicação liberada', mensagem: novo.status === 'em_aprovacao' ? 'O RH foi avisado. Você recebe o retorno (aprovada ou rejeitada, com o motivo) no sino e por aviso no aparelho.' : 'Você não precisa de aprovação: a publicação já está liberada para publicar na plataforma.' });
    } catch (e) { await avisar({ titulo: 'Não deu certo', mensagem: (e as Error).message }); }
  };
  return (
    <>
      <Crud<Rede> base="/api/gestao/redes" rotuloItem="publicação" feminino idDe={(r) => r.id}
        introducao={`Registre o que vai ser publicado no Instagram e em outras plataformas: escolha a plataforma, escreva a legenda e envie a imagem. ${exigeAprovacao ? 'Ao enviar, o RH recebe para aprovar; você acompanha o retorno aqui e no sino.' : 'Você não precisa de aprovação: ao enviar, a publicação já fica liberada.'} Depois de aprovada, publique na plataforma e marque como publicada.`}
        campos={[
          { chave: 'plataforma', rotulo: 'Plataforma', tipo: 'select', opcoes: PLATAFORMAS, metade: true },
          { chave: 'data_prevista', rotulo: 'Data prevista (opcional)', tipo: 'data', metade: true },
          { chave: 'titulo', rotulo: 'Título (uso interno)', obrigatorio: true, max: 120, dica: 'Ex.: Dia do Cliente. Só a equipe vê.' },
          { chave: 'legenda', rotulo: 'Legenda / texto da publicação', tipo: 'area', linhas: 6, max: 2200 },
          { chave: 'imagem', rotulo: 'Imagem ou arte (opcional)', tipo: 'imagem' },
          { chave: 'link', rotulo: 'Link a divulgar (opcional)', max: 500, dica: 'Endereço que a publicação vai citar.' },
        ]}
        colunas={[
          { titulo: 'Plataforma', ver: (r) => nomeDe(r.plataforma) },
          { titulo: 'Título', ver: (r) => r.titulo },
          { titulo: 'Situação', ver: (r) => { const [t, x] = SIT[r.status] ?? ['neutro', r.status]; return <><Selo texto={x} tom={t} />{r.status === 'rejeitada' && r.motivo && <small className="motivo-rej">Motivo: {r.motivo}</small>}</>; } },
          { titulo: 'Data prevista', ver: (r) => dataCurta(r.data_prevista) || '—' },
          { titulo: 'Criada por', ver: (r) => r.autor ?? '—' },
        ]}
        valoresNovos={{ plataforma: 'instagram', data_prevista: '', titulo: '', legenda: '', imagem: '', link: '' }}
        paraForm={(r) => ({ plataforma: r.plataforma, data_prevista: s(r.data_prevista), titulo: r.titulo, legenda: s(r.legenda), imagem: s(r.imagem), link: s(r.link) })}
        podeApagar={(r) => r.status !== 'em_aprovacao'}
        acoesExtra={(r, _salvar, recarregar) => podeEditar ? (<>
          {(r.status === 'rascunho' || r.status === 'rejeitada') && <button className="btn btn-verde btn-pequeno" onClick={() => void enviar(r, recarregar)}>{r.status === 'rejeitada' ? 'Reenviar para aprovação' : exigeAprovacao ? 'Enviar para aprovação' : 'Liberar'}</button>}
          {r.status === 'aprovada' && <button className="btn btn-verde btn-pequeno" onClick={() => setPublicando({ r, recarregar })}>Marcar como publicada</button>}
          {r.status === 'publicada' && r.link_publicado && <a className="btn btn-sec btn-pequeno" href={r.link_publicado} target="_blank" rel="noopener noreferrer">Ver publicação</a>}
        </>) : null}
      />
      {publicando && <JanelaPublicada r={publicando.r} aoFechar={() => setPublicando(null)} aoConcluir={() => { publicando.recarregar(); setPublicando(null); }} />}
    </>
  );
}
