import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { MarcaEntrada, PADRAO_ENTRADA, type ConfigEntrada } from '../MarcaEntrada';
import { DicaAba } from '../Dica';

/** Envia uma imagem para a tela de entrada e devolve o endereço público dela. */
async function enviar(arq: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(arq.type)) throw new Error('Use uma imagem PNG, JPG, WebP ou GIF.');
  if (arq.size > 5 * 1024 * 1024) throw new Error('A imagem passa de 5 MB. Escolha uma menor.');
  const r = await fetch('/api/gestao/entrada/imagens', { method: 'POST', headers: { 'Content-Type': arq.type }, body: arq, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({})) as { url?: string; erro?: string };
  if (!r.ok || !j.url) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j.url;
}

const FUNDOS: [ConfigEntrada['fundo'], string, string][] = [
  ['cor', 'Cor sólida', 'O degradê do tema, como hoje.'], ['imagem', 'Imagem fixa', 'Uma imagem sempre igual.'], ['carrossel', 'Carrossel', 'Várias imagens que se alternam.'],
];

/** Configurações › Tela de entrada: lateral da tela de login (fundo, ícone, título, frase e textos), com prévia ao vivo. */
export function EntradaConfig({ permissoes }: { permissoes: string[] }) {
  const edita = permissoes.includes('cfg.entrada.editar');
  const [cfg, setCfg] = useState<ConfigEntrada | null>(null);
  const [salvo, setSalvo] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { api<ConfigEntrada>('/api/entrada').then((c) => { setCfg({ ...PADRAO_ENTRADA, ...c }); setSalvo(JSON.stringify({ ...PADRAO_ENTRADA, ...c })); }).catch((e: Error) => setErro(e.message)); }, []);
  if (!cfg) return erro ? <p className="erro" role="alert">{erro}</p> : <p className="vazio">Carregando…</p>;
  const mudou = JSON.stringify(cfg) !== salvo;
  const set = (p: Partial<ConfigEntrada>) => { setCfg({ ...cfg, ...p }); setAviso(''); };

  const subir = async (arqs: FileList | null, aoSubir: (urls: string[]) => void) => {
    if (!arqs?.length) return;
    setErro(''); setEnviando(true);
    try { const urls: string[] = []; for (const a of Array.from(arqs)) urls.push(await enviar(a)); aoSubir(urls); }
    catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  };
  const mover = (k: number, d: -1 | 1) => { const l = [...cfg.imagens]; const j = k + d; if (j < 0 || j >= l.length) return; [l[k], l[j]] = [l[j], l[k]]; set({ imagens: l }); };
  const salvar = async () => {
    setErro(''); setAviso('');
    try { const r = await api<ConfigEntrada>('/api/gestao/entrada', cfg, 'PUT'); setCfg({ ...PADRAO_ENTRADA, ...r }); setSalvo(JSON.stringify({ ...PADRAO_ENTRADA, ...r })); setAviso('Tela de entrada salva. Vale para a próxima vez que alguém abrir o login.'); }
    catch (e) { setErro((e as Error).message); }
  };
  const comImagem = cfg.fundo !== 'cor';

  return (
    <section className="calcfg">
      <DicaAba>Personalize a lateral da tela de login: o fundo (cor, imagem ou carrossel) e os textos. O nome e o ícone da empresa que aparecem no topo vêm de Configurações › Empresa. A prévia ao lado mostra como vai ficar.</DicaAba>
      {aviso && <p className="ok" role="status" style={{ margin: 0 }}>{aviso}</p>}
      {erro && <p className="erro" role="alert" style={{ margin: 0 }}>{erro}</p>}

      <div className="entcfg">
        <div className="entcfg-form">
          <div className="calcfg-card">
            <h3>Fundo</h3>
            <div className="entcfg-fundos" role="radiogroup" aria-label="Tipo de fundo">
              {FUNDOS.map(([id, nome, dica]) => (
                <label key={id} className={`entcfg-fundo${cfg.fundo === id ? ' on' : ''}`}>
                  <input type="radio" name="fundo" checked={cfg.fundo === id} disabled={!edita} onChange={() => set({ fundo: id })} />
                  <b>{nome}</b><small className="suave">{dica}</small>
                </label>
              ))}
            </div>
            {comImagem && (
              <>
                <div className="entcfg-imgs">
                  {cfg.imagens.map((u, k) => (
                    <div key={u} className="entcfg-img">
                      <img src={u} alt={`Imagem ${k + 1}`} />
                      {edita && (
                        <span className="entcfg-img-acoes">
                          {cfg.fundo === 'carrossel' && <><button type="button" aria-label="Mover para antes" disabled={k === 0} onClick={() => mover(k, -1)}><Icone nome="esq" tamanho={12} /></button>
                            <button type="button" aria-label="Mover para depois" disabled={k === cfg.imagens.length - 1} onClick={() => mover(k, 1)}><Icone nome="dir" tamanho={12} /></button></>}
                          <button type="button" aria-label="Remover imagem" onClick={() => set({ imagens: cfg.imagens.filter((x) => x !== u) })}>×</button>
                        </span>
                      )}
                    </div>
                  ))}
                  {edita && (cfg.fundo === 'carrossel' ? cfg.imagens.length < 8 : cfg.imagens.length < 1) && (
                    <label className="entcfg-add">{enviando ? 'Enviando…' : '+ Adicionar imagem'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={cfg.fundo === 'carrossel'} className="so-leitor" disabled={enviando}
                        onChange={(e) => { void subir(e.target.files, (urls) => set({ imagens: cfg.fundo === 'carrossel' ? [...cfg.imagens, ...urls].slice(0, 8) : urls.slice(0, 1) })); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                <small className="suave">Use imagens largas (por exemplo 1200 × 1400 px), PNG, JPG, WebP ou GIF, até 5 MB cada{cfg.fundo === 'carrossel' ? '; no máximo 8, na ordem mostrada' : ''}.</small>
                <label className="entcfg-campo">Escurecer a imagem: {cfg.escurecer}%
                  <input type="range" min={0} max={80} step={5} value={cfg.escurecer} disabled={!edita} onChange={(e) => set({ escurecer: Number(e.target.value) })} />
                  <small className="suave">Ajuda a ler o texto sobre fotos claras.</small>
                </label>
                {cfg.fundo === 'carrossel' && (
                  <label className="entcfg-campo">Trocar a imagem a cada
                    <select value={cfg.intervalo} disabled={!edita} onChange={(e) => set({ intervalo: Number(e.target.value) })}>
                      {[4, 6, 8, 12, 20, 30].map((s) => <option key={s} value={s}>{s} segundos</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>

          <div className="calcfg-card">
            <h3>Frase e textos</h3>
            <label className="entcfg-campo">Frase em letras espaçadas (uma por linha, até 5)
              <textarea rows={4} value={cfg.linhas.join('\n')} disabled={!edita} onChange={(e) => set({ linhas: e.target.value.split('\n').slice(0, 5) })} />
            </label>
            <label className="entcfg-campo">Texto pequeno embaixo
              <input value={cfg.rodape} maxLength={60} disabled={!edita} onChange={(e) => set({ rodape: e.target.value })} placeholder="Ex.: Slogan da empresa" />
            </label>
            <label className="entcfg-campo">Texto extra (opcional, acima da frase)
              <textarea rows={2} value={cfg.texto_extra} maxLength={200} disabled={!edita} onChange={(e) => set({ texto_extra: e.target.value })} placeholder="Ex.: Bem-vindo à intranet da fábrica." />
            </label>
          </div>

          {edita && (
            <div className="entcfg-rodape">
              <button className="btn" disabled={!mudou || enviando} onClick={() => void salvar()}>Salvar tela de entrada</button>
              <button className="btn btn-sec" onClick={() => set({ ...PADRAO_ENTRADA, linhas: [] })}>Restaurar o padrão</button>
            </div>
          )}
        </div>
        <div className="entcfg-previa">
          <small className="suave">Prévia</small>
          <MarcaEntrada cfg={{ ...cfg, linhas: cfg.linhas.map((l) => l.trim()).filter(Boolean) }} previa />
        </div>
      </div>
    </section>
  );
}
