import { confirmar } from '../Confirmar.tsx';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Selo } from './Crud';
import { DicaAba } from '../Dica';

interface Estado {
  ativo: boolean; total: number; por_tabela: Record<string, number>; empresa: string; producao: boolean; permitido: boolean; senha_exemplo: string | null;
  usuarios: { login: string; nome: string; perfil: string }[];
}
const ROTULOS: [string, string][] = [
  ['comunicados', 'Comunicados'], ['documentos', 'Documentos'], ['aplicacoes', 'Aplicativos'], ['banners', 'Banners'], ['destaques', 'Colaboradores destaque'],
  ['aniversariantes', 'Aniversariantes'], ['novos_colaboradores', 'Novos colaboradores'], ['contatos', 'Contatos'], ['calendario_datas', 'Datas do calendário'],
  ['pulsos', 'Pesquisa de pulso'], ['usuarios', 'Usuários de exemplo'], ['imagens_arquivo', 'Imagens (guardadas no banco)'],
];

/** Configurações › Dados de exemplo (só administrador): liga ou desliga o pacote de dados fictícios da empresa "Aurora Esportes". */
export function DadosExemplo() {
  const [e, setE] = useState<Estado | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { api<Estado>('/api/gestao/demonstracao').then(setE).catch((x: Error) => setErro(x.message)); }, []);

  const mudar = async (ativo: boolean) => {
    if (!ativo && !(await confirmar({ titulo: 'Desligar dados de exemplo', mensagem: 'Desligar os dados de exemplo? Os comunicados, documentos, banners, pessoas, imagens e usuários de exemplo são apagados e a identidade da empresa volta ao que era antes. O que sua empresa cadastrou de verdade não é tocado.', confirmar: 'Desligar', perigo: true }))) return;
    if (ativo && !(await confirmar({ titulo: 'Ligar dados de exemplo', mensagem: 'Ligar os dados de exemplo? A identidade da empresa (nome, logo e tela de entrada) passa a ser a da empresa fictícia "Aurora Esportes" até você desligar.', confirmar: 'Ligar' }))) return;
    setOcupado(true); setErro('');
    try { setE(await api<Estado>('/api/gestao/demonstracao', { ativo })); window.location.reload(); }
    catch (x) { setErro((x as Error).message); setOcupado(false); }
  };

  if (!e && !erro) return <p className="vazio">Carregando…</p>;
  return (
    <section className="crud">
      <DicaAba>Dados fictícios da empresa {e?.empresa ?? 'Aurora Esportes'} para testar o portal (e demonstrar a quem ainda não conhece). Ficam gravados no banco, imagens inclusive, e aparecem para qualquer pessoa que entrar, em qualquer computador ou celular. Desligar apaga só o que veio do exemplo.</DicaAba>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {e && (
        <div className="cartao-sec">
          <div className="barra" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Dados de exemplo</h3>
            <Selo texto={e.ativo ? 'Ligados' : 'Desligados'} tom={e.ativo ? 'ok' : 'neutro'} />
            <button type="button" className={e.ativo ? 'btn btn-sec' : 'btn'} disabled={ocupado || (!e.ativo && !e.permitido)} title={!e.ativo && !e.permitido ? 'Bloqueado em produção' : undefined} onClick={() => void mudar(!e.ativo)}>
              {ocupado ? 'Aguarde…' : e.ativo ? 'Desligar dados de exemplo' : 'Ligar dados de exemplo'}
            </button>
          </div>
          {e.ativo ? (
            <>
              <p className="suave">Em uso: {e.total} registros da empresa fictícia <b>{e.empresa}</b>.</p>
              <ul className="lista-simples">
                {ROTULOS.filter(([k]) => e.por_tabela[k]).map(([k, nome]) => <li key={k}>{nome}: <b>{e.por_tabela[k]}</b></li>)}
              </ul>
              {e.usuarios.length > 0 && (
                <p className="suave">
                  Usuários para testar: {e.usuarios.map((u) => <code key={u.login} style={{ marginRight: 8 }}>{u.login}</code>)}
                  {e.senha_exemplo ? <> (senha de <code>ana.demo</code>, <code>bruno.demo</code> e <code>carla.demo</code>: <code>{e.senha_exemplo}</code>; <code>editor</code>: editor123; <code>leitor</code>: leitor123)</> : ' (em produção, estes usuários não têm senha: ninguém entra com eles)'}.
                </p>
              )}
            </>
          ) : <p className="suave">Desligados: o portal mostra só o que sua empresa cadastrou. Ligue para ver comunicados, documentos, banners, pessoas do mês, calendário e uma pesquisa de pulso de exemplo.</p>}
        </div>
      )}
    </section>
  );
}
