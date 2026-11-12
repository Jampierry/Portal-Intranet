import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone, IconeSistema } from '../icones';
import { Capa, Lema } from '../Capa';
import { definirEmpresa, LogoNome, PADRAO_EMPRESA, type ConfigEmpresa } from '../empresa';
import { DicaAba } from '../Dica';

async function enviarIcone(arq: File): Promise<string> {
  const ehSvg = /\.svg$/i.test(arq.name) || arq.type === 'image/svg+xml';
  if (!ehSvg && !/^image\/(png|jpeg|webp|gif)$/.test(arq.type)) throw new Error('Use uma imagem PNG, JPG, WebP, GIF ou SVG.');
  if (arq.size > 5 * 1024 * 1024) throw new Error('A imagem passa de 5 MB. Escolha uma menor.');
  const r = await fetch('/api/gestao/empresa/imagens', { method: 'POST', headers: { 'Content-Type': ehSvg ? 'image/svg+xml' : arq.type }, body: arq, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({})) as { url?: string; erro?: string };
  if (!r.ok || !j.url) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j.url;
}
const linhasDe = (v: string) => v.split('\n').slice(0, 5);
const limpas = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
type CampoImagem = 'logo' | 'logo_nome' | 'logo_nome_escuro';

/** Dados da empresa em edição (rascunho), compartilhados pelas abas Empresa e Comunicados: cada aba grava o conjunto completo. */
function useConfigEmpresa(permissoes: string[], aviso0: string) {
  const edita = permissoes.includes('cfg.empresa.editar');
  const [cfg, setCfg] = useState<ConfigEmpresa | null>(null);
  const [salvo, setSalvo] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState<'' | CampoImagem>('');
  useEffect(() => { api<ConfigEmpresa>('/api/empresa').then((c) => { const v = { ...PADRAO_EMPRESA, ...c }; setCfg(v); setSalvo(JSON.stringify(v)); }).catch((e: Error) => setErro(e.message)); }, []);
  const mudou = !!cfg && JSON.stringify(cfg) !== salvo;
  const set = (p: Partial<ConfigEmpresa>) => { if (cfg) { setCfg({ ...cfg, ...p }); setAviso(''); } };
  const salvar = async () => {
    setErro(''); setAviso('');
    try { const r = await api<ConfigEmpresa>('/api/gestao/empresa', cfg, 'PUT'); const v = { ...PADRAO_EMPRESA, ...r }; setCfg(v); setSalvo(JSON.stringify(v)); definirEmpresa(v); setAviso(aviso0); }
    catch (e) { setErro((e as Error).message); }
  };
  const trocarImagem = async (campo: CampoImagem, arq?: File) => { if (!arq) return; setErro(''); setEnviando(campo); try { set({ [campo]: await enviarIcone(arq) }); } catch (e) { setErro((e as Error).message); } finally { setEnviando(''); } };
  return { edita, cfg, mudou, aviso, erro, enviando, set, salvar, trocarImagem };
}

function Mensagens({ aviso, erro }: { aviso: string; erro: string }) {
  return <>{aviso && <p className="ok" role="status" style={{ margin: 0 }}>{aviso}</p>}{erro && <p className="erro" role="alert" style={{ margin: 0 }}>{erro}</p>}</>;
}

const ACEITA = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg';

/** Configurações › Empresa: identidade (ícone, logo, nomes), menu lateral e rodapé. Cada seção mostra, ao lado, como fica na tela onde aparece.
 *  Os textos dos Comunicados ficam na aba Comunicados; o fundo e as frases da tela de login, em Tela de entrada; os feriados, em Calendário. */
export function EmpresaConfig({ permissoes }: { permissoes: string[] }) {
  const { edita, cfg, mudou, aviso, erro, enviando, set, salvar, trocarImagem } = useConfigEmpresa(permissoes, 'Dados da empresa salvos. Já valem em todas as telas.');
  if (!cfg) return erro ? <p className="erro" role="alert">{erro}</p> : <p className="vazio">Carregando…</p>;
  const logoUma = (campo: 'logo_nome' | 'logo_nome_escuro', tema: 'claro' | 'escuro', remover: string) => (
    <div className="empcfg-icone empcfg-logonome">
      <span className={`empcfg-logo-img ${tema}`}>{cfg[campo] ? <img src={cfg[campo]!} alt={`Logo para o tema ${tema}`} /> : <small>Sem logo</small>}</span>
      <small className="empcfg-rot">{tema === 'claro' ? 'Para fundo claro' : 'Para fundo escuro'}</small>
      {edita && (
        <span className="empcfg-icone-acoes">
          <label className="btn btn-sec btn-pequeno" style={{ margin: 0 }}>{enviando === campo ? 'Enviando…' : 'Trocar logo'}
            <input type="file" accept={ACEITA} className="so-leitor" disabled={!!enviando} onChange={(e) => { void trocarImagem(campo, e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {cfg[campo] && <button type="button" className="empcfg-link" onClick={() => set({ [campo]: null })}>{remover}</button>}
        </span>
      )}
    </div>
  );

  return (
    <section className="calcfg">
      <Mensagens aviso={aviso} erro={erro} />
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
                      <input type="file" accept={ACEITA} className="so-leitor" disabled={!!enviando} onChange={(e) => { void trocarImagem('logo', e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {cfg.logo && <button type="button" className="empcfg-link" onClick={() => set({ logo: null })}>Usar o padrão</button>}
                  </span>
                )}
              </div>
              <label className="empcfg-campo">Nome da empresa *
                <input value={cfg.nome} maxLength={40} disabled={!edita} onChange={(e) => set({ nome: e.target.value })} />
              </label>
              {logoUma('logo_nome', 'claro', 'Remover')}
              {logoUma('logo_nome_escuro', 'escuro', 'Remover')}
              <label className="empcfg-campo">Nome do portal *
                <input value={cfg.nome_portal} maxLength={40} disabled={!edita} onChange={(e) => set({ nome_portal: e.target.value })} />
              </label>
            </div>
            <small className="suave">O nome aparece no menu, na tela de login, no Início, nos comunicados e no rodapé; o nome do portal, na aba do navegador e no login. O ícone é quadrado; a logo é a imagem do nome da empresa (de preferência com fundo transparente) e substitui o nome escrito no menu e no login. Envie uma versão para fundo claro (letras escuras) e outra para fundo escuro (letras claras): o menu lateral e a lateral do login usam a versão que combina com a cor do menu do estilo escolhido, e o portal troca sozinho. Na maioria dos estilos o menu é escuro, então vale a logo para fundo escuro. Com só uma, ela vale para todos. PNG, JPG, WebP, GIF ou SVG (sem scripts), até 5 MB cada.</small>
          </fieldset>

          <fieldset className="empcfg-bloco">
            <legend>Menu lateral</legend>
            <div className="empcfg-linha duas">
              <label className="empcfg-campo">Slogan (abaixo do nome, no menu)
                <input value={cfg.slogan} maxLength={60} disabled={!edita} onChange={(e) => set({ slogan: e.target.value })} placeholder="Opcional" />
              </label>
            </div>
          </fieldset>

          <fieldset className="empcfg-bloco">
            <legend>Aniversário da empresa</legend>
            <div className="empcfg-linha duas">
              <label className="empcfg-campo">Data de fundação (opcional)
                <input type="date" value={cfg.fundacao ?? ''} max={new Date().toISOString().slice(0, 10)} disabled={!edita} onChange={(e) => set({ fundacao: e.target.value || null })} />
              </label>
            </div>
            <small className="suave">Com a data, o Início mostra a contagem regressiva para o aniversário da empresa e comemora no dia.</small>
          </fieldset>

          <fieldset className="empcfg-bloco">
            <legend>Rodapé</legend>
            <div className="empcfg-linha duas">
              <label className="empcfg-campo">Frase do rodapé (em todas as telas)
                <input value={cfg.frase_rodape} maxLength={120} disabled={!edita} onChange={(e) => set({ frase_rodape: e.target.value })} placeholder="Opcional" />
              </label>
            </div>
          </fieldset>

          <DicaAba>Procurando outra coisa? Frases e rótulo dos comunicados: aba <b>Comunicados</b>. A tela de login, com a prévia dela: aba <b>Tela de entrada</b> (ela usa o nome e a logo daqui). Feriados: aba <b>Calendário</b>.</DicaAba>

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
              <div className="brandtxt">{(cfg.logo_nome || cfg.logo_nome_escuro) ? <LogoNome cfg={cfg} classe="empnome-img" sobre="menu" /> : <span className="empnome">{cfg.nome || '—'}</span>}{cfg.slogan && <span>{cfg.slogan}</span>}</div>
              <span className="menubtn" aria-hidden="true"><Icone nome="menu" tamanho={20} /></span>
            </div>
          </div>
          <span className="prev-rotulo">Rodapé</span>
          <footer className="rodape-portal prev-rodape-real"><span><b>{cfg.nome || '—'}</b>{cfg.frase_rodape ? ` | ${cfg.frase_rodape}` : ''}</span><span>{cfg.nome_portal}</span></footer>
        </aside>
      </div>
    </section>
  );
}

/** Configurações › Comunicados: textos do painel e do comunicado em destaque da tela Comunicados, com prévia ao lado. */
export function ComunicadosConfig({ permissoes }: { permissoes: string[] }) {
  const { edita, cfg, mudou, aviso, erro, set, salvar } = useConfigEmpresa(permissoes, 'Textos dos comunicados salvos. Já valem na tela Comunicados.');
  if (!cfg) return erro ? <p className="erro" role="alert">{erro}</p> : <p className="vazio">Carregando…</p>;
  return (
    <section className="calcfg">
      <Mensagens aviso={aviso} erro={erro} />
      <div className="empcfg">
        <div className="empcfg-form">
          <fieldset className="empcfg-bloco">
            <legend>Comunicado em destaque</legend>
            <div className="empcfg-linha duas">
              <label className="empcfg-campo">Rótulo (etiqueta sobre o título)
                <input value={cfg.rotulo_destaque} maxLength={20} disabled={!edita} onChange={(e) => set({ rotulo_destaque: e.target.value })} placeholder="DESTAQUE" />
              </label>
              <label className="empcfg-campo">Frase sobre a capa
                <textarea rows={3} value={cfg.lema_destaque.join('\n')} disabled={!edita} onChange={(e) => set({ lema_destaque: linhasDe(e.target.value) })} placeholder="Uma linha por frase" />
              </label>
            </div>
          </fieldset>

          <fieldset className="empcfg-bloco">
            <legend>Painel lateral</legend>
            <div className="empcfg-linha duas">
              <label className="empcfg-campo">Frase do painel (abaixo dos temas)
                <textarea rows={3} value={cfg.lema.join('\n')} disabled={!edita} onChange={(e) => set({ lema: linhasDe(e.target.value) })} placeholder="Uma linha por frase" />
              </label>
            </div>
            <small className="suave">As frases usam até 5 linhas, uma por linha.</small>
          </fieldset>

          {edita && (
            <div className="entcfg-rodape">
              <button className="btn" disabled={!mudou} onClick={() => void salvar()}>Salvar textos dos comunicados</button>
            </div>
          )}
        </div>

        <aside className="empcfg-previa" aria-label="Prévia">
          <small className="suave">Como vai aparecer</small>
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
          <span className="prev-rotulo">Painel lateral (Comunicados)</span>
          <section className="painel-marca prev-painel-marca">{limpas(cfg.lema).length > 0 && <Lema linhas={limpas(cfg.lema)} />}<b>{cfg.nome}</b>{cfg.slogan && <small>{cfg.slogan}</small>}</section>
        </aside>
      </div>
    </section>
  );
}
