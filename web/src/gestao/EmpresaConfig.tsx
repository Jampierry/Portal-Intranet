import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone, IconeSistema } from '../icones';
import { Capa, Lema } from '../Capa';
import { definirEmpresa, PADRAO_EMPRESA, type ConfigEmpresa } from '../empresa';

async function enviarIcone(arq: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(arq.type)) throw new Error('Use uma imagem PNG, JPG, WebP ou GIF.');
  if (arq.size > 5 * 1024 * 1024) throw new Error('A imagem passa de 5 MB. Escolha uma menor.');
  const r = await fetch('/api/gestao/empresa/imagens', { method: 'POST', headers: { 'Content-Type': arq.type }, body: arq, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({})) as { url?: string; erro?: string };
  if (!r.ok || !j.url) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j.url;
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const linhasDe = (v: string) => v.split('\n').slice(0, 5);
const limpas = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);

/** Configurações › Empresa: nome, textos e ícone que aparecem no menu, rodapé, login e painéis; feriados municipais. Com prévia ao lado. */
export function EmpresaConfig({ permissoes }: { permissoes: string[] }) {
  const edita = permissoes.includes('cfg.empresa.editar');
  const [cfg, setCfg] = useState<ConfigEmpresa | null>(null);
  const [salvo, setSalvo] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState<'' | 'logo' | 'logo_nome'>('');
  useEffect(() => { api<ConfigEmpresa>('/api/empresa').then((c) => { const v = { ...PADRAO_EMPRESA, ...c }; setCfg(v); setSalvo(JSON.stringify(v)); }).catch((e: Error) => setErro(e.message)); }, []);
  if (!cfg) return erro ? <p className="erro" role="alert">{erro}</p> : <p className="vazio">Carregando…</p>;
  const mudou = JSON.stringify(cfg) !== salvo;
  const set = (p: Partial<ConfigEmpresa>) => { setCfg({ ...cfg, ...p }); setAviso(''); };
  const salvar = async () => {
    setErro(''); setAviso('');
    try { const r = await api<ConfigEmpresa>('/api/gestao/empresa', cfg, 'PUT'); const v = { ...PADRAO_EMPRESA, ...r }; setCfg(v); setSalvo(JSON.stringify(v)); definirEmpresa(v); setAviso('Dados da empresa salvos. Já valem em todas as telas.'); }
    catch (e) { setErro((e as Error).message); }
  };
  const trocarImagem = async (campo: 'logo' | 'logo_nome', arq?: File) => { if (!arq) return; setErro(''); setEnviando(campo); try { set({ [campo]: await enviarIcone(arq) }); } catch (e) { setErro((e as Error).message); } finally { setEnviando(''); } };
  const feriado = (k: number, p: Partial<ConfigEmpresa['feriados_municipais'][number]>) => set({ feriados_municipais: cfg.feriados_municipais.map((f, i) => (i === k ? { ...f, ...p } : f)) });

  return (
    <section className="calcfg">
      {aviso && <p className="ok" role="status" style={{ margin: 0 }}>{aviso}</p>}
      {erro && <p className="erro" role="alert" style={{ margin: 0 }}>{erro}</p>}

      <div className="empcfg">
        <div className="empcfg-form">
          <fieldset className="empcfg-bloco">
            <legend>Identificação</legend>
            <div className="empcfg-linha ident">
              <div className="empcfg-icone">
                <span className="empcfg-icone-img">{cfg.logo ? <img src={cfg.logo} alt="Ícone atual" /> : <IconeSistema tamanho={40} />}</span>
                {edita && (
                  <span className="empcfg-icone-acoes">
                    <label className="btn btn-sec btn-pequeno" style={{ margin: 0 }}>{enviando === 'logo' ? 'Enviando…' : 'Trocar ícone'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="so-leitor" disabled={!!enviando} onChange={(e) => { void trocarImagem('logo', e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {cfg.logo && <button type="button" className="empcfg-link" onClick={() => set({ logo: null })}>Usar o padrão</button>}
                  </span>
                )}
              </div>
              <label className="empcfg-campo">Nome da empresa *
                <input value={cfg.nome} maxLength={40} disabled={!edita} onChange={(e) => set({ nome: e.target.value })} />
              </label>
              <div className="empcfg-icone empcfg-logonome">
                <span className="empcfg-logo-img">{cfg.logo_nome ? <img src={cfg.logo_nome} alt="Logo atual" /> : <small>Sem logo: aparece o nome escrito</small>}</span>
                {edita && (
                  <span className="empcfg-icone-acoes">
                    <label className="btn btn-sec btn-pequeno" style={{ margin: 0 }}>{enviando === 'logo_nome' ? 'Enviando…' : 'Trocar logo'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="so-leitor" disabled={!!enviando} onChange={(e) => { void trocarImagem('logo_nome', e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {cfg.logo_nome && <button type="button" className="empcfg-link" onClick={() => set({ logo_nome: null })}>Usar o nome escrito</button>}
                  </span>
                )}
              </div>
              <label className="empcfg-campo">Nome do portal *
                <input value={cfg.nome_portal} maxLength={40} disabled={!edita} onChange={(e) => set({ nome_portal: e.target.value })} />
              </label>
            </div>
            <small className="suave">O nome aparece no menu, login, Início, comunicados e rodapé; o nome do portal, na aba do navegador e no login. O ícone é quadrado; a logo é a imagem do nome da empresa (de preferência com fundo transparente) e substitui o nome escrito no menu e no login. Até 5 MB cada.</small>
          </fieldset>

          <fieldset className="empcfg-bloco">
            <legend>Textos</legend>
            <div className="empcfg-linha duas">
              <label className="empcfg-campo">Slogan
                <input value={cfg.slogan} maxLength={60} disabled={!edita} onChange={(e) => set({ slogan: e.target.value })} placeholder="Opcional" />
              </label>
              <label className="empcfg-campo">Frase do rodapé
                <input value={cfg.frase_rodape} maxLength={120} disabled={!edita} onChange={(e) => set({ frase_rodape: e.target.value })} placeholder="Opcional" />
              </label>
            </div>
            <div className="empcfg-linha tres">
              <label className="empcfg-campo">Frase do painel dos Comunicados
                <textarea rows={3} value={cfg.lema.join('\n')} disabled={!edita} onChange={(e) => set({ lema: linhasDe(e.target.value) })} placeholder="Uma linha por frase" />
              </label>
              <label className="empcfg-campo">Rótulo do comunicado em destaque
                <input value={cfg.rotulo_destaque} maxLength={20} disabled={!edita} onChange={(e) => set({ rotulo_destaque: e.target.value })} placeholder="DESTAQUE" />
              </label>
              <label className="empcfg-campo">Frase sobre a capa do destaque
                <textarea rows={3} value={cfg.lema_destaque.join('\n')} disabled={!edita} onChange={(e) => set({ lema_destaque: linhasDe(e.target.value) })} placeholder="Uma linha por frase" />
              </label>
            </div>
            <small className="suave">As frases usam até 5 linhas, uma por linha. A frase da tela de login fica em Tela de entrada.</small>
          </fieldset>

          <fieldset className="empcfg-bloco">
            <legend>Feriados municipais</legend>
            {cfg.feriados_municipais.map((f, k) => (
              <div key={k} className="empcfg-feriado">
                <input value={f.titulo} maxLength={80} disabled={!edita} onChange={(e) => feriado(k, { titulo: e.target.value })} placeholder="Nome do feriado" aria-label="Nome do feriado" />
                <input type="number" min={1} max={31} value={f.dia} disabled={!edita} onChange={(e) => feriado(k, { dia: Number(e.target.value) })} aria-label="Dia" />
                <select value={f.mes} disabled={!edita} onChange={(e) => feriado(k, { mes: Number(e.target.value) })} aria-label="Mês">
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                {edita && <button type="button" className="empcfg-x" aria-label="Remover feriado" onClick={() => set({ feriados_municipais: cfg.feriados_municipais.filter((_, i) => i !== k) })}>×</button>}
              </div>
            ))}
            <div className="empcfg-rodape-bloco">
              <small className="suave">{cfg.feriados_municipais.length === 0 ? 'Nenhum cadastrado. ' : ''}Usados em Calendário › “Gerar feriados”.</small>
              {edita && <button type="button" className="btn btn-sec btn-pequeno" disabled={cfg.feriados_municipais.length >= 10} onClick={() => set({ feriados_municipais: [...cfg.feriados_municipais, { titulo: '', dia: 1, mes: 1 }] })}><Icone nome="mais" tamanho={13} /> Adicionar feriado</button>}
            </div>
          </fieldset>

          {edita && (
            <div className="entcfg-rodape">
              <button className="btn" disabled={!mudou || !!enviando || !cfg.nome.trim() || !cfg.nome_portal.trim()} onClick={() => void salvar()}>Salvar dados da empresa</button>
            </div>
          )}
        </div>

        <aside className="empcfg-previa" aria-label="Prévia">
          <small className="suave">Como vai aparecer</small>
          <span className="prev-rotulo">Menu lateral</span>
          <div className="menu prev-menu-real">
            <div className="sbtop">
              <span className="appbtn">{cfg.logo ? <img src={cfg.logo} alt="" width={30} height={30} style={{ objectFit: 'contain', borderRadius: 8 }} /> : <IconeSistema tamanho={30} />}</span>
              <div className="brandtxt">{cfg.logo_nome ? <img className="empnome-img" src={cfg.logo_nome} alt={cfg.nome} /> : <span className="empnome">{cfg.nome || '—'}</span>}{cfg.slogan && <span>{cfg.slogan}</span>}</div>
            </div>
          </div>
          <span className="prev-rotulo">Comunicado em destaque (Comunicados)</span>
          <div className="prev-escala">
            <section className="destaque-com" aria-label="Prévia do comunicado em destaque">
              <div className="destaque-com-texto">
                {cfg.rotulo_destaque && <span className="etiqueta">{cfg.rotulo_destaque}</span>}
                <h2>Título do comunicado em destaque</h2>
                <p>Resumo do comunicado, como aparece para quem lê.</p>
                <span className="btn btn-pri">Saiba mais <Icone nome="seta" tamanho={16} /></span>
              </div>
              <Capa semente="previa-empresa" icone="comunicados">{limpas(cfg.lema_destaque).length > 0 && <Lema linhas={limpas(cfg.lema_destaque)} classe="lema-capa" />}</Capa>
            </section>
          </div>
          <span className="prev-rotulo">Rodapé</span>
          <footer className="rodape-portal prev-rodape-real"><span><b>{cfg.nome || '—'}</b>{cfg.frase_rodape ? ` | ${cfg.frase_rodape}` : ''}</span><span>{cfg.nome_portal}</span></footer>
        </aside>
      </div>
    </section>
  );
}
