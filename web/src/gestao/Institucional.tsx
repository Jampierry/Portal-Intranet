import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { usePermissoes } from './Crud';
import { DicaAba } from '../Dica';

interface Inst { missao: string; visao: string; proposito: string; valores: string[] }

/** Edição de missão, visão e valores (aparecem no Início). Valores: um por linha, até 8. */
export function Institucional() {
  const perms = usePermissoes();
  const podeEditar = perms === null || perms.includes('pub.institucional.editar');
  const [v, setV] = useState({ missao: '', visao: '', proposito: '', valores: '' });
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api<Inst>('/api/institucional').then((d) => { setV({ missao: d.missao, visao: d.visao, proposito: d.proposito, valores: d.valores.join('\n') }); setPronto(true); }).catch((x) => setErro((x as Error).message));
  }, []);

  const salvar = async (e: FormEvent) => {
    e.preventDefault(); setErro(''); setAviso(''); setSalvando(true);
    try { await api('/api/gestao/institucional', v, 'PUT'); setAviso('Salvo. O Início já mostra o novo texto.'); }
    catch (x) { setErro((x as Error).message); } finally { setSalvando(false); }
  };

  return (
    <section className="cartao-sec">
      <DicaAba>Aparecem no Início, ao lado do colaborador destaque. Deixe tudo em branco para esconder a seção.</DicaAba>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {pronto && (
        <form onSubmit={salvar}>
          <label htmlFor="inst-missao">Missão<textarea id="inst-missao" rows={3} maxLength={400} value={v.missao} onChange={(e) => setV({ ...v, missao: e.target.value })} /></label>
          <label htmlFor="inst-visao">Visão<textarea id="inst-visao" rows={3} maxLength={400} value={v.visao} onChange={(e) => setV({ ...v, visao: e.target.value })} /></label>
          <label htmlFor="inst-proposito">Propósito<textarea id="inst-proposito" rows={3} maxLength={400} value={v.proposito} onChange={(e) => setV({ ...v, proposito: e.target.value })} /></label>
          <label htmlFor="inst-valores">Valores (um por linha, até 8)<textarea id="inst-valores" rows={6} maxLength={800} value={v.valores} onChange={(e) => setV({ ...v, valores: e.target.value })} /></label>
          {podeEditar ? <button className="btn" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button> : <p className="suave">Você só pode ver este conteúdo.</p>}
        </form>
      )}
    </section>
  );
}
