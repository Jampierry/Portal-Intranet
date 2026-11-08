import { api } from '../api';
import { Icone } from '../icones';
import { useEffect, useState } from 'react';
import { Crud, JanelaForm, PermissoesCtx, Selo } from './Crud';
import { Aplicacoes } from '../aplicacoes/Aplicacoes';
import { Administracao } from './Administracao';
import { Institucional } from './Institucional';
import { ICONES_ESCOLHA } from '../iconesAuto';
import { Cabecalho } from '../Cabecalho';
import { dataCurta, MESES_LONGOS, periodoDe, useLista } from '../dados';
import { ListaPerfis } from './Permissoes';
import { Integracoes } from './Integracoes';
import { CalendarioConfig } from './CalendarioConfig';
import { EntradaConfig } from './EntradaConfig';
import { ComunicadosConfig, EmpresaConfig } from './EmpresaConfig';
import { podeAbaCalendario } from '../calendarioTipos';
import { Aniversariantes, NovosColaboradores } from './PessoasMes';
import { AvisosEmail } from './AvisosEmail';

const s = (v: string | null | undefined) => v ?? '';
const SIT_COM: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { publicado: ['ok', 'Publicado'], rascunho: ['aviso', 'Rascunho'], arquivado: ['neutro', 'Arquivado'] };

interface Com { id: number; titulo: string; resumo: string; corpo: string | null; categoria: string; prioridade: string; imagem: string | null; status: string; exibir_de: string | null; exibir_ate: string | null; publicado_em: string | null; exige_leitura: number }
interface Leituras { titulo: string; total: number; lidos: { nome: string; login: string; lido_em: string }[]; pendentes: { nome: string; login: string }[] }
/** Janela "Leituras": quem já confirmou e quem falta confirmar um comunicado. */
function LeiturasComunicado({ c, aoFechar }: { c: Com; aoFechar: () => void }) {
  const { dados, erro } = useLeituras(c.id);
  const pct = dados && dados.total ? Math.round((dados.lidos.length / dados.total) * 100) : 0;
  return (
    <JanelaForm titulo={`Leituras: ${c.titulo}`} rotuloEnviar="Fechar" aoFechar={aoFechar} aoEnviar={async () => aoFechar()}>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!dados && !erro && <p className="suave">Carregando…</p>}
      {dados && (
        <div className="leitura-rel">
          <p style={{ margin: 0 }}><b>{dados.lidos.length} de {dados.total}</b> pessoas confirmaram ({pct}%).</p>
          <div className="leitura-barra" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          <div className="leitura-listas">
            <div><b>Confirmaram ({dados.lidos.length})</b>
              <ul>{dados.lidos.length === 0 ? <li className="suave">Ninguém ainda.</li> : dados.lidos.map((p) => <li key={p.login}><span>{p.nome}</span><small className="suave">{dataCurta(p.lido_em.slice(0, 10))}</small></li>)}</ul></div>
            <div><b>Faltam ({dados.pendentes.length})</b>
              <ul>{dados.pendentes.length === 0 ? <li className="suave">Todos confirmaram.</li> : dados.pendentes.map((p) => <li key={p.login}><span>{p.nome}</span><small className="suave">{p.login}</small></li>)}</ul></div>
          </div>
        </div>
      )}
    </JanelaForm>
  );
}
function useLeituras(id: number) {
  const [dados, setDados] = useState<Leituras | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api<Leituras>(`/api/gestao/comunicados/${id}/leituras`).then(setDados).catch((e: Error) => setErro(e.message)); }, [id]);
  return { dados, erro };
}

function Comunicados() {
  const [leituras, setLeituras] = useState<Com | null>(null);
  const { dados } = useLista<Com>('/api/gestao/comunicados');
  const categorias = [...new Set((dados ?? []).map((c) => c.categoria))];
  return (
    <>
    <Crud<Com> base="/api/gestao/comunicados" rotuloItem="comunicado" idDe={(r) => r.id}
      introducao="Rascunho não aparece no portal. Ao publicar, a data de publicação é registrada. Para tirar do ar sem perder, use Arquivar."
      campos={[
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 120 },
        { chave: 'resumo', rotulo: 'Resumo (aparece nos cartões)', obrigatorio: true, max: 300 },
        { chave: 'corpo', rotulo: 'Texto completo', tipo: 'area', max: 5000, dica: 'Separe os parágrafos com uma linha em branco.' },
        { chave: 'imagem', rotulo: 'Imagem de capa (opcional)', tipo: 'imagem' },
        { chave: 'categoria', rotulo: 'Categoria', obrigatorio: true, max: 40, sugestoes: categorias, metade: true },
        { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: [['normal', 'Normal'], ['urgente', 'Urgente (aparece no sino)']], metade: true },
        { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['rascunho', 'Rascunho'], ['publicado', 'Publicado'], ['arquivado', 'Arquivado']], metade: true },
        { chave: 'exige_leitura', rotulo: 'Exigir confirmação de leitura', tipo: 'check', dica: 'Cada pessoa vê o botão “Li e estou ciente”, o comunicado aparece em Avisos até ser confirmado e você acompanha quem leu em “Leituras”.' },
        { chave: 'exibir_de', rotulo: 'Exibir a partir de (opcional)', tipo: 'data', metade: true },
        { chave: 'exibir_ate', rotulo: 'Exibir até (opcional)', tipo: 'data', metade: true },
      ]}
      colunas={[
        { titulo: 'Título', ver: (r) => r.titulo },
        { titulo: 'Categoria', ver: (r) => r.categoria },
        { titulo: 'Situação', ver: (r) => { const [t, x] = SIT_COM[r.status] ?? ['neutro', r.status]; return <><Selo texto={x} tom={t} />{r.prioridade === 'urgente' && <> <Selo texto="Urgente" tom="erro" /></>}</>; } },
        { titulo: 'Publicado em', ver: (r) => dataCurta(r.publicado_em) || '—' },
      ]}
      valoresNovos={{ titulo: '', resumo: '', corpo: '', imagem: '', categoria: '', prioridade: 'normal', status: 'rascunho', exige_leitura: false, exibir_de: '', exibir_ate: '' }}
      paraForm={(r) => ({ titulo: r.titulo, resumo: r.resumo, corpo: s(r.corpo), imagem: s(r.imagem), categoria: r.categoria, prioridade: r.prioridade, status: r.status, exige_leitura: !!r.exige_leitura, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) })}
      podeApagar={() => true}
      acoesExtra={(r, salvar) => {
        const base = { titulo: r.titulo, resumo: r.resumo, corpo: s(r.corpo), imagem: s(r.imagem), categoria: r.categoria, prioridade: r.prioridade, exige_leitura: !!r.exige_leitura, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) };
        return <>
          {r.exige_leitura ? <button className="btn btn-sec btn-pequeno" onClick={() => setLeituras(r)}>Leituras</button> : null}
          {r.status === 'publicado'
            ? <button className="btn btn-sec btn-pequeno" onClick={() => void salvar({ ...base, status: 'arquivado' })}>Arquivar</button>
            : <button className="btn btn-verde btn-pequeno" onClick={() => void salvar({ ...base, status: 'publicado' })}>Publicar</button>}
        </>;
      }}
    />
    {leituras && <LeiturasComunicado c={leituras} aoFechar={() => setLeituras(null)} />}
    </>
  );
}

interface Ban { id: number; titulo: string; subtitulo: string | null; imagem: string | null; botao_texto: string | null; link: string | null; posicao: string; ordem: number; ativo: number; exibir_de: string | null; exibir_ate: string | null }
const POSICOES_BANNER: [string, string][] = [['principal', 'Carrossel da esquerda (maior)'], ['lateral1', 'Carrossel do meio'], ['lateral2', 'Carrossel da direita']];
const NOME_POSICAO: Record<string, string> = { principal: 'Esquerda', lateral1: 'Meio', lateral2: 'Direita' };
const ORDENS: [string, string][] = Array.from({ length: 9 }, (_, i) => [String(i + 1), String(i + 1)]);
/** Banners do carrossel "Novidades da semana" do Início: imagem, texto, botão e ordem. Sem banner ativo, o Início mostra a faixa padrão. */
function Banners() {
  return (
    <Crud<Ban> base="/api/gestao/banners" rotuloItem="banner" idDe={(r) => r.id}
      introducao="O topo do Início tem 3 carrosséis lado a lado que giram juntos: esquerda (maior), meio e direita. Escolha em qual cada banner aparece; a ordem vale dentro de cada carrossel. Carrossel da esquerda sem banner mostra a faixa padrão."
      campos={[
        { chave: 'posicao', rotulo: 'Em qual carrossel aparece', tipo: 'select', opcoes: POSICOES_BANNER },
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 80 },
        { chave: 'subtitulo', rotulo: 'Subtítulo (só no carrossel da esquerda)', max: 160 },
        { chave: 'imagem', rotulo: 'Imagem do banner', tipo: 'imagem', dica: 'Formato largo: esquerda ≈ 1000 × 330 px; meio e direita ≈ 700 × 330 px. PNG, JPG, WebP ou GIF, até 5 MB. Sem imagem = fundo em cor do tema.' },
        { chave: 'botao_texto', rotulo: 'Texto do botão', max: 30, dica: 'Ex.: Saiba mais (obrigatório se houver link)', metade: true },
        { chave: 'link', rotulo: 'Link do botão', tipo: 'link', max: 300, dica: 'Escolha um comunicado ou página do portal, ou use um endereço externo. Preencha também o texto do botão.', metade: true },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'select', opcoes: ORDENS, metade: true },
        { chave: 'ativo', rotulo: 'Ativo (aparece no Início)', tipo: 'check' },
        { chave: 'exibir_de', rotulo: 'Exibir a partir de (opcional)', tipo: 'data', metade: true },
        { chave: 'exibir_ate', rotulo: 'Exibir até (opcional)', tipo: 'data', metade: true },
      ]}
      colunas={[
        { titulo: 'Carrossel', ver: (r) => NOME_POSICAO[r.posicao] ?? r.posicao },
        { titulo: 'Ordem', ver: (r) => r.ordem },
        { titulo: 'Título', ver: (r) => r.titulo },
        { titulo: 'Imagem', ver: (r) => (r.imagem ? 'Sim' : 'Cor do tema') },
        { titulo: 'Situação', ver: (r) => <Selo texto={r.ativo ? 'Ativo' : 'Inativo'} tom={r.ativo ? 'ok' : 'neutro'} /> },
      ]}
      valoresNovos={{ posicao: 'principal', titulo: '', subtitulo: '', imagem: '', botao_texto: '', link: '', ordem: '1', ativo: true, exibir_de: '', exibir_ate: '' }}
      paraForm={(r) => ({ posicao: r.posicao, titulo: r.titulo, subtitulo: s(r.subtitulo), imagem: s(r.imagem), botao_texto: s(r.botao_texto), link: s(r.link), ordem: String(r.ordem), ativo: !!r.ativo, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) })}
    />
  );
}

interface Doc { id: number; titulo: string; categoria: string; resumo: string; formato: string; versao: string | null; responsavel: string | null; classificacao: string; link_oficial: string | null; revisado_em: string | null }
function Documentos() {
  const { dados } = useLista<Doc>('/api/gestao/documentos');
  const categorias = [...new Set((dados ?? []).map((d) => d.categoria))];
  return (
    <Crud<Doc> base="/api/gestao/documentos" rotuloItem="documento" idDe={(r) => r.id}
      introducao="O arquivo fica no sistema de origem: informe o link oficial. Documento 'restrito' só aparece para editores e administradores."
      campos={[
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 120 },
        { chave: 'resumo', rotulo: 'Resumo', obrigatorio: true, max: 300 },
        { chave: 'categoria', rotulo: 'Categoria', obrigatorio: true, max: 40, sugestoes: categorias, metade: true },
        { chave: 'formato', rotulo: 'Formato', obrigatorio: true, max: 40, dica: 'Ex.: PDF, Planilha', metade: true },
        { chave: 'versao', rotulo: 'Versão', max: 20, metade: true },
        { chave: 'responsavel', rotulo: 'Responsável', max: 80, metade: true },
        { chave: 'classificacao', rotulo: 'Quem pode ver', tipo: 'select', opcoes: [['interno', 'Todos os logados'], ['publico', 'Público (interno, sem restrição)'], ['restrito', 'Restrito (editores e admin)']], metade: true },
        { chave: 'revisado_em', rotulo: 'Revisado em', tipo: 'data', metade: true },
        { chave: 'link_oficial', rotulo: 'Link do documento (http/https)', max: 500 },
      ]}
      colunas={[
        { titulo: 'Título', ver: (r) => r.titulo },
        { titulo: 'Categoria', ver: (r) => r.categoria },
        { titulo: 'Versão', ver: (r) => r.versao ?? '—' },
        { titulo: 'Responsável', ver: (r) => r.responsavel ?? '—' },
        { titulo: 'Acesso', ver: (r) => <Selo texto={r.classificacao === 'restrito' ? 'Restrito' : 'Liberado'} tom={r.classificacao === 'restrito' ? 'aviso' : 'ok'} /> },
        { titulo: 'Link', ver: (r) => (r.link_oficial ? 'Sim' : 'Sem link') },
      ]}
      valoresNovos={{ titulo: '', resumo: '', categoria: '', formato: 'PDF', versao: '', responsavel: '', classificacao: 'interno', revisado_em: '', link_oficial: '' }}
      paraForm={(r) => ({ titulo: r.titulo, resumo: r.resumo, categoria: r.categoria, formato: r.formato, versao: s(r.versao), responsavel: s(r.responsavel), classificacao: r.classificacao, revisado_em: s(r.revisado_em), link_oficial: s(r.link_oficial) })}
    />
  );
}

interface Dest { id: number; mes: number | null; ano: number | null; nome: string; area: string; apresentacao: string; consentimento_ref: string | null; status: string; foto: string | null }
const ANOS_DESTAQUE: [string, string][] = Array.from({ length: 6 }, (_, i) => { const a = new Date().getFullYear() + 1 - i; return [String(a), String(a)] as [string, string]; });
const SIT_DEST: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { aprovado: ['ok', 'Aprovado'], rascunho: ['aviso', 'Rascunho'], retirado: ['neutro', 'Retirado'] };
function Destaques() {
  return (
    <Crud<Dest> base="/api/gestao/destaques" rotuloItem="destaque" idDe={(r) => r.id}
      introducao="Reconhecimento sem ranking. Só aparece no portal o que estiver Aprovado, e para aprovar é preciso registrar o consentimento da pessoa (LGPD)."
      campos={[
        { chave: 'foto', rotulo: 'Foto da pessoa (opcional)', tipo: 'imagem', dica: 'Foto quadrada (rosto centralizado) fica melhor. PNG, JPG, WebP ou GIF, até 5 MB. Use só com o consentimento da pessoa; sem foto, aparecem as iniciais.' },
        { chave: 'nome', rotulo: 'Nome da pessoa', obrigatorio: true, max: 80, metade: true },
        { chave: 'area', rotulo: 'Área', obrigatorio: true, max: 60, metade: true },
        { chave: 'mes', rotulo: 'Mês do destaque', tipo: 'select', opcoes: MESES_LONGOS.map((m, i) => [String(i + 1), m] as [string, string]), metade: true },
        { chave: 'ano', rotulo: 'Ano do destaque', tipo: 'select', opcoes: ANOS_DESTAQUE, metade: true, dica: 'No Início, a aba Mês mostra o mês atual e a aba Ano mostra todos os destaques do ano atual.' },
        { chave: 'apresentacao', rotulo: 'Texto de reconhecimento', tipo: 'area', obrigatorio: true, max: 300 },
        { chave: 'consentimento_ref', rotulo: 'Referência do consentimento', max: 200, dica: 'Ex.: termo assinado em 02/10/2026 (obrigatório para aprovar)' },
        { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['rascunho', 'Rascunho'], ['aprovado', 'Aprovado'], ['retirado', 'Retirado']], metade: true },
      ]}
      colunas={[
        { titulo: 'Nome', ver: (r) => r.nome },
        { titulo: 'Área', ver: (r) => r.area },
        { titulo: 'Mês/Ano', ver: (r) => (r.ano ? periodoDe({ mes: r.mes, ano: r.ano }) : '— (definir)') },
        { titulo: 'Situação', ver: (r) => { const [t, x] = SIT_DEST[r.status] ?? ['neutro', r.status]; return <Selo texto={x} tom={t} />; } },
      ]}
      valoresNovos={{ foto: '', nome: '', area: '', mes: String(new Date().getMonth() + 1), ano: String(new Date().getFullYear()), apresentacao: '', consentimento_ref: '', status: 'rascunho' }}
      paraForm={(r) => ({ foto: s(r.foto), nome: r.nome, area: r.area, mes: String(r.mes ?? new Date().getMonth() + 1), ano: String(r.ano ?? new Date().getFullYear()), apresentacao: r.apresentacao, consentimento_ref: s(r.consentimento_ref), status: r.status })}
    />
  );
}

interface Cont { id: number; departamento: string; nome: string; canal: string; ramal: string | null; celular: string | null; publicavel: number }
function Contatos() {
  const { dados } = useLista<Cont>('/api/gestao/contatos');
  const areas = [...new Set((dados ?? []).map((c) => c.departamento))];
  return (
    <Crud<Cont> base="/api/gestao/contatos" rotuloItem="contato" idDe={(r) => r.id}
      introducao="Canais das áreas (e-mail, ramal, celular corporativo, ferramenta). Não cadastre dados pessoais de funcionários. A área nova é criada ao salvar."
      campos={[
        { chave: 'departamento', rotulo: 'Área', obrigatorio: true, max: 60, sugestoes: areas, metade: true },
        { chave: 'nome', rotulo: 'Assunto / contato', obrigatorio: true, max: 80, dica: 'Ex.: Folha de pagamento', metade: true },
        { chave: 'canal', rotulo: 'Canal (e-mail ou link)', max: 120, dica: 'E-mail ou endereço http(s) de chamados', metade: true },
        { chave: 'ramal', rotulo: 'Ramal', max: 20, dica: 'Ex.: 2400', metade: true },
        { chave: 'celular', rotulo: 'Celular corporativo', max: 20, dica: 'Com DDD. Ex.: (62) 99999-0000 — informe ao menos canal, ramal ou celular', metade: true },
        { chave: 'publicavel', rotulo: 'Aparece no portal', tipo: 'check' },
      ]}
      colunas={[
        { titulo: 'Área', ver: (r) => r.departamento },
        { titulo: 'Assunto', ver: (r) => r.nome },
        { titulo: 'Canal', ver: (r) => r.canal },
        { titulo: 'Ramal', ver: (r) => r.ramal ?? '' },
        { titulo: 'Celular', ver: (r) => r.celular ?? '' },
        { titulo: 'Situação', ver: (r) => <Selo texto={r.publicavel ? 'Publicado' : 'Oculto'} tom={r.publicavel ? 'ok' : 'neutro'} /> },
      ]}
      valoresNovos={{ departamento: '', nome: '', canal: '', ramal: '', celular: '', publicavel: true }}
      paraForm={(r) => ({ departamento: r.departamento, nome: r.nome, canal: r.canal, ramal: s(r.ramal), celular: s(r.celular), publicavel: !!r.publicavel })}
    />
  );
}

interface App { slug: string; nome: string; descricao: string; categoria: string; url: string; acesso: string; icone: string; logo: string | null; responsavel: string | null; ativo: number; restrita: number }
function CadastroAplicacoes() {
  return (
    <Crud<App> base="/api/gestao/aplicacoes" rotuloItem="aplicação" idDe={(r) => r.slug}
      introducao="Cada aplicação é um link para um sistema externo. Só cadastre endereços confirmados. Inativa = some do portal, mas fica aqui."
      campos={[
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 60, metade: true },
        { chave: 'categoria', rotulo: 'Categoria', obrigatorio: true, max: 40, metade: true },
        { chave: 'descricao', rotulo: 'Descrição', obrigatorio: true, max: 200 },
        { chave: 'url', rotulo: 'Endereço (http/https)', obrigatorio: true, max: 500 },
        { chave: 'acesso', rotulo: 'Condição de acesso', obrigatorio: true, max: 200, dica: 'Ex.: Acesso restrito a colaboradores' },
        { chave: 'responsavel', rotulo: 'Responsável', max: 80, metade: true },
        { chave: 'logo', rotulo: 'Ícone do aplicativo', tipo: 'imagem', auto: { endpoint: '/api/gestao/aplicacoes/icone', origem: 'url', rotulo: 'Buscar do aplicativo' }, dica: 'Ao informar o endereço, o portal tenta trazer o ícone do próprio aplicativo. Se não achar (ex.: sistema que exige login), use "Escolher imagem". Sem imagem, vale o ícone abaixo (automático = pela categoria e nome).' },
        { chave: 'icone', rotulo: 'Ícone (quando não há imagem)', tipo: 'select', opcoes: ICONES_ESCOLHA, metade: true },
        { chave: 'ativo', rotulo: 'Ativa (aparece no portal)', tipo: 'check' },
        { chave: 'restrita', rotulo: 'Restrita: só aparece para quem for liberado', tipo: 'check', dica: 'Marque para apps que não são para todos. Depois libere cada pessoa em Configurações › Usuários › Aplicativos. O administrador sempre vê.' },
      ]}
      colunas={[
        { titulo: 'Nome', ver: (r) => r.nome },
        { titulo: 'Categoria', ver: (r) => r.categoria },
        { titulo: 'Endereço', ver: (r) => <span className="trunca" title={r.url}>{r.url}</span> },
        { titulo: 'Situação', ver: (r) => <><Selo texto={r.ativo ? 'Ativa' : 'Inativa'} tom={r.ativo ? 'ok' : 'neutro'} />{r.restrita ? <> <Selo texto="Restrita" tom="aviso" /></> : null}</> },
      ]}
      valoresNovos={{ nome: '', categoria: '', descricao: '', url: 'https://', acesso: '', responsavel: '', icone: 'auto', logo: '', ativo: true, restrita: false }}
      paraForm={(r) => ({ nome: r.nome, categoria: r.categoria, descricao: r.descricao, url: r.url, acesso: r.acesso, responsavel: s(r.responsavel), icone: r.icone === 'users' ? 'pessoas' : r.icone === 'apps' ? 'auto' : r.icone, logo: s(r.logo), ativo: !!r.ativo, restrita: !!r.restrita })}
    />
  );
}

/** Aba Aplicativos: o mesmo conteúdo em dois formatos (catálogo em cartões ou lista em tabela). Criar, editar e excluir seguem as permissões de cada pessoa. */
function Aplicativos({ busca, limparBusca, favoritos, alternarFavorito }: { busca: string; limparBusca: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void }) {
  const [vista, setVista] = useState<'catalogo' | 'lista'>(() => { try { return localStorage.getItem('portal.apps.vista') === 'lista' ? 'lista' : 'catalogo'; } catch { return 'catalogo'; } });
  const trocar = (v: 'catalogo' | 'lista') => { setVista(v); try { localStorage.setItem('portal.apps.vista', v); } catch { /* vale só nesta sessão */ } };
  return (
    <>
      <div className="pilulas filtros vistas" role="group" aria-label="Formato de exibição dos aplicativos">
        <button aria-pressed={vista === 'catalogo'} onClick={() => trocar('catalogo')} title="Catálogo (cartões)" aria-label="Catálogo (cartões)"><Icone nome="vista-grade" tamanho={18} /></button>
        <button aria-pressed={vista === 'lista'} onClick={() => trocar('lista')} title="Lista (tabela)" aria-label="Lista (tabela)"><Icone nome="vista-lista" tamanho={18} /></button>
      </div>
      {vista === 'catalogo'
        ? <Aplicacoes semCabecalho busca={busca} limparBusca={limparBusca} favoritos={favoritos} alternarFavorito={alternarFavorito} />
        : <CadastroAplicacoes />}
    </>
  );
}

type AbaPub = 'comunicados' | 'banners' | 'institucional' | 'documentos' | 'destaques' | 'aniversariantes' | 'novos' | 'contatos' | 'aplicacoes';
const ABAS_PUBLICAR: [AbaPub, string][] = [
  ['comunicados', 'Comunicados'], ['banners', 'Banners (Novidades)'], ['institucional', 'Missão, Visão e Valores'], ['documentos', 'Documentos'], ['destaques', 'Colaborador Destaque'], ['aniversariantes', 'Aniversariantes'], ['novos', 'Novos colaboradores'], ['contatos', 'Contatos'], ['aplicacoes', 'Aplicativos'],
];

/** Publicar: editor e admin cuidam do conteúdo do portal (comunicados, documentos, colaborador destaque, contatos e aplicativos). */
export function Publicar({ permissoes, aba: pedida, aoMudarAba, busca, limparBusca, favoritos, alternarFavorito }: {
  permissoes: string[]; aba?: string; aoMudarAba: (a: string) => void; busca: string; limparBusca: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void;
}) {
  // Só as abas que a pessoa pode usar (a aba Aplicativos usa a permissão pub.aplicativos).
  const abas = ABAS_PUBLICAR.filter(([id]) => permissoes.includes(`pub.${id === 'aplicacoes' ? 'aplicativos' : id}.ver`));
  const aba: AbaPub = abas.find(([id]) => id === pedida)?.[0] ?? abas[0][0];
  return (
    <>
      <Cabecalho titulo="Publicar" sub="Publique comunicados, banners, missão e valores, documentos, colaborador destaque, aniversariantes, novos colaboradores, contatos e aplicativos." />
      <div className="abas abas-gestao" role="tablist" aria-label="O que publicar">
        {abas.map(([id, nome]) => <button key={id} role="tab" aria-selected={aba === id} onClick={() => aoMudarAba(id)}>{nome}</button>)}
      </div>
      <PermissoesCtx.Provider value={permissoes}>
      {aba === 'comunicados' && <Comunicados />}
      {aba === 'banners' && <Banners />}
      {aba === 'institucional' && <Institucional />}
      {aba === 'documentos' && <Documentos />}
      {aba === 'destaques' && <Destaques />}
      {aba === 'aniversariantes' && <Aniversariantes />}
      {aba === 'novos' && <NovosColaboradores />}
      {aba === 'contatos' && <Contatos />}
      {aba === 'aplicacoes' && <Aplicativos busca={busca} limparBusca={limparBusca} favoritos={favoritos} alternarFavorito={alternarFavorito} />}
      </PermissoesCtx.Provider>
    </>
  );
}

type AbaCfg = 'usuarios' | 'perfis' | 'empresa' | 'entrada' | 'comunicados' | 'calendario' | 'integracoes' | 'auditoria';
const ABAS_CONFIG: [AbaCfg, string][] = [['usuarios', 'Usuários'], ['perfis', 'Perfis'], ['empresa', 'Empresa'], ['entrada', 'Tela de entrada'], ['comunicados', 'Comunicados'], ['calendario', 'Calendário'], ['integracoes', 'Integrações'], ['auditoria', 'Auditoria']];
/** Configurações: usuários, perfis e auditoria. Cada aba aparece só para quem recebeu a permissão (administrador vê todas). */
export function Configuracoes({ permissoes, souAdmin, aba: pedida, aoMudarAba }: { permissoes: string[]; souAdmin: boolean; aba?: string; aoMudarAba: (a: string) => void }) {
  const abas = ABAS_CONFIG.filter(([id]) => (id === 'calendario' ? podeAbaCalendario(permissoes) : permissoes.includes(`cfg.${id === 'comunicados' ? 'empresa' : id}.ver`)));
  if (abas.length === 0) return <p className="erro">Você não tem acesso às configurações.</p>;
  const aba: AbaCfg = abas.find(([id]) => id === pedida)?.[0] ?? abas[0][0];
  return (
    <>
      <Cabecalho titulo="Configurações" sub="Usuários, perfis de acesso, empresa, tela de entrada, comunicados, calendário, integrações e auditoria do portal." />
      <div className="abas abas-gestao" role="tablist" aria-label="Configurações">
        {abas.map(([id, nome]) => <button key={id} role="tab" aria-selected={aba === id} onClick={() => aoMudarAba(id)}>{nome}</button>)}
      </div>
      {aba === 'perfis' ? <ListaPerfis souAdmin={souAdmin} permissoes={permissoes} />
        : aba === 'integracoes' ? <><Integracoes permissoes={permissoes} /><AvisosEmail permissoes={permissoes} /></>
        : aba === 'calendario' ? <CalendarioConfig permissoes={permissoes} />
        : aba === 'entrada' ? <EntradaConfig permissoes={permissoes} />
        : aba === 'empresa' ? <EmpresaConfig permissoes={permissoes} />
        : aba === 'comunicados' ? <ComunicadosConfig permissoes={permissoes} />
        : <Administracao parte={aba} souAdmin={souAdmin} permissoes={permissoes} />}
    </>
  );
}
