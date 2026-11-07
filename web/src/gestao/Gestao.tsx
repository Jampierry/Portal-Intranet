import { useState } from 'react';
import { Crud, Selo } from './Crud';
import { Aplicacoes } from '../aplicacoes/Aplicacoes';
import { Administracao } from './Administracao';
import { ICONES_ESCOLHA } from '../iconesAuto';
import { Cabecalho } from '../Cabecalho';
import { dataCurta, useLista } from '../dados';
import type { PerfilAcesso } from '../sessao';

const s = (v: string | null | undefined) => v ?? '';
const SIT_COM: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { publicado: ['ok', 'Publicado'], rascunho: ['aviso', 'Rascunho'], arquivado: ['neutro', 'Arquivado'] };

interface Com { id: number; titulo: string; resumo: string; corpo: string | null; categoria: string; prioridade: string; imagem: string | null; status: string; exibir_de: string | null; exibir_ate: string | null; publicado_em: string | null }
function Comunicados() {
  const { dados } = useLista<Com>('/api/gestao/comunicados');
  const categorias = [...new Set((dados ?? []).map((c) => c.categoria))];
  return (
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
        { chave: 'exibir_de', rotulo: 'Exibir a partir de (opcional)', tipo: 'data', metade: true },
        { chave: 'exibir_ate', rotulo: 'Exibir até (opcional)', tipo: 'data', metade: true },
      ]}
      colunas={[
        { titulo: 'Título', ver: (r) => r.titulo },
        { titulo: 'Categoria', ver: (r) => r.categoria },
        { titulo: 'Situação', ver: (r) => { const [t, x] = SIT_COM[r.status] ?? ['neutro', r.status]; return <><Selo texto={x} tom={t} />{r.prioridade === 'urgente' && <> <Selo texto="Urgente" tom="erro" /></>}</>; } },
        { titulo: 'Publicado em', ver: (r) => dataCurta(r.publicado_em) || '—' },
      ]}
      valoresNovos={{ titulo: '', resumo: '', corpo: '', imagem: '', categoria: '', prioridade: 'normal', status: 'rascunho', exibir_de: '', exibir_ate: '' }}
      paraForm={(r) => ({ titulo: r.titulo, resumo: r.resumo, corpo: s(r.corpo), imagem: s(r.imagem), categoria: r.categoria, prioridade: r.prioridade, status: r.status, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) })}
      podeApagar={() => true}
      acoesExtra={(r, salvar) => {
        const base = { titulo: r.titulo, resumo: r.resumo, corpo: s(r.corpo), imagem: s(r.imagem), categoria: r.categoria, prioridade: r.prioridade, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) };
        return r.status === 'publicado'
          ? <button className="btn btn-sec btn-pequeno" onClick={() => void salvar({ ...base, status: 'arquivado' })}>Arquivar</button>
          : <button className="btn btn-verde btn-pequeno" onClick={() => void salvar({ ...base, status: 'publicado' })}>Publicar</button>;
      }}
    />
  );
}

interface Ban { id: number; titulo: string; subtitulo: string | null; imagem: string | null; botao_texto: string | null; link: string | null; ordem: number; ativo: number; exibir_de: string | null; exibir_ate: string | null }
const ORDENS: [string, string][] = Array.from({ length: 9 }, (_, i) => [String(i + 1), String(i + 1)]);
/** Banners do carrossel "Novidades da semana" do Início: imagem, texto, botão e ordem. Sem banner ativo, o Início mostra a faixa padrão. */
function Banners() {
  return (
    <Crud<Ban> base="/api/gestao/banners" rotuloItem="banner" idDe={(r) => r.id}
      introducao="Os banners ativos giram no topo do Início, na ordem indicada. Sem nenhum banner ativo, aparece a faixa padrão."
      campos={[
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 80 },
        { chave: 'subtitulo', rotulo: 'Subtítulo', max: 160 },
        { chave: 'imagem', rotulo: 'Imagem do banner', tipo: 'imagem', dica: 'Formato largo, ideal 1600 × 400 px. PNG, JPG, WebP ou GIF, até 5 MB. Sem imagem = fundo em cor do tema.' },
        { chave: 'botao_texto', rotulo: 'Texto do botão', max: 30, dica: 'Ex.: Saiba mais (obrigatório se houver link)', metade: true },
        { chave: 'link', rotulo: 'Link do botão', max: 300, dica: 'Página do portal (ex.: #comunicados) ou endereço https://…', metade: true },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'select', opcoes: ORDENS, metade: true },
        { chave: 'ativo', rotulo: 'Ativo (aparece no Início)', tipo: 'check' },
        { chave: 'exibir_de', rotulo: 'Exibir a partir de (opcional)', tipo: 'data', metade: true },
        { chave: 'exibir_ate', rotulo: 'Exibir até (opcional)', tipo: 'data', metade: true },
      ]}
      colunas={[
        { titulo: 'Ordem', ver: (r) => r.ordem },
        { titulo: 'Título', ver: (r) => r.titulo },
        { titulo: 'Imagem', ver: (r) => (r.imagem ? 'Sim' : 'Cor do tema') },
        { titulo: 'Situação', ver: (r) => <Selo texto={r.ativo ? 'Ativo' : 'Inativo'} tom={r.ativo ? 'ok' : 'neutro'} /> },
      ]}
      valoresNovos={{ titulo: '', subtitulo: '', imagem: '', botao_texto: '', link: '', ordem: '1', ativo: true, exibir_de: '', exibir_ate: '' }}
      paraForm={(r) => ({ titulo: r.titulo, subtitulo: s(r.subtitulo), imagem: s(r.imagem), botao_texto: s(r.botao_texto), link: s(r.link), ordem: String(r.ordem), ativo: !!r.ativo, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) })}
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

interface Dest { id: number; tipo: string; rotulo: string; nome: string; area: string; apresentacao: string; consentimento_ref: string | null; status: string }
const SIT_DEST: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { aprovado: ['ok', 'Aprovado'], rascunho: ['aviso', 'Rascunho'], retirado: ['neutro', 'Retirado'] };
function Destaques() {
  return (
    <Crud<Dest> base="/api/gestao/destaques" rotuloItem="destaque" idDe={(r) => r.id}
      introducao="Reconhecimento sem ranking. Só aparece no portal o que estiver Aprovado, e para aprovar é preciso registrar o consentimento da pessoa (LGPD)."
      campos={[
        { chave: 'nome', rotulo: 'Nome da pessoa', obrigatorio: true, max: 80, metade: true },
        { chave: 'area', rotulo: 'Área', obrigatorio: true, max: 60, metade: true },
        { chave: 'tipo', rotulo: 'Destaque do', tipo: 'select', opcoes: [['mes', 'Mês'], ['ano', 'Ano']], metade: true },
        { chave: 'rotulo', rotulo: 'Período', obrigatorio: true, max: 40, dica: 'Ex.: Novembro/2026 ou 2026', metade: true },
        { chave: 'apresentacao', rotulo: 'Texto de reconhecimento', tipo: 'area', obrigatorio: true, max: 300 },
        { chave: 'consentimento_ref', rotulo: 'Referência do consentimento', max: 200, dica: 'Ex.: termo assinado em 02/10/2026 (obrigatório para aprovar)' },
        { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['rascunho', 'Rascunho'], ['aprovado', 'Aprovado'], ['retirado', 'Retirado']], metade: true },
      ]}
      colunas={[
        { titulo: 'Nome', ver: (r) => r.nome },
        { titulo: 'Área', ver: (r) => r.area },
        { titulo: 'Período', ver: (r) => `${r.tipo === 'mes' ? 'Mês' : 'Ano'} · ${r.rotulo}` },
        { titulo: 'Situação', ver: (r) => { const [t, x] = SIT_DEST[r.status] ?? ['neutro', r.status]; return <Selo texto={x} tom={t} />; } },
      ]}
      valoresNovos={{ nome: '', area: '', tipo: 'mes', rotulo: '', apresentacao: '', consentimento_ref: '', status: 'rascunho' }}
      paraForm={(r) => ({ nome: r.nome, area: r.area, tipo: r.tipo, rotulo: r.rotulo, apresentacao: r.apresentacao, consentimento_ref: s(r.consentimento_ref), status: r.status })}
    />
  );
}

interface Cont { id: number; departamento: string; nome: string; canal: string; publicavel: number }
function Contatos() {
  const { dados } = useLista<Cont>('/api/gestao/contatos');
  const areas = [...new Set((dados ?? []).map((c) => c.departamento))];
  return (
    <Crud<Cont> base="/api/gestao/contatos" rotuloItem="contato" idDe={(r) => r.id}
      introducao="Canais das áreas (e-mail, ramal, ferramenta). Não cadastre dados pessoais de funcionários. A área nova é criada ao salvar."
      campos={[
        { chave: 'departamento', rotulo: 'Área', obrigatorio: true, max: 60, sugestoes: areas, metade: true },
        { chave: 'nome', rotulo: 'Assunto / contato', obrigatorio: true, max: 80, dica: 'Ex.: Folha de pagamento', metade: true },
        { chave: 'canal', rotulo: 'Canal', obrigatorio: true, max: 120, dica: 'E-mail, ramal ou endereço http(s) de chamados' },
        { chave: 'publicavel', rotulo: 'Aparece no portal', tipo: 'check' },
      ]}
      colunas={[
        { titulo: 'Área', ver: (r) => r.departamento },
        { titulo: 'Assunto', ver: (r) => r.nome },
        { titulo: 'Canal', ver: (r) => r.canal },
        { titulo: 'Situação', ver: (r) => <Selo texto={r.publicavel ? 'Publicado' : 'Oculto'} tom={r.publicavel ? 'ok' : 'neutro'} /> },
      ]}
      valoresNovos={{ departamento: '', nome: '', canal: '', publicavel: true }}
      paraForm={(r) => ({ departamento: r.departamento, nome: r.nome, canal: r.canal, publicavel: !!r.publicavel })}
    />
  );
}

interface App { slug: string; nome: string; descricao: string; categoria: string; url: string; acesso: string; icone: string; logo: string | null; responsavel: string | null; ativo: number }
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
      ]}
      colunas={[
        { titulo: 'Nome', ver: (r) => r.nome },
        { titulo: 'Categoria', ver: (r) => r.categoria },
        { titulo: 'Endereço', ver: (r) => <span className="trunca" title={r.url}>{r.url}</span> },
        { titulo: 'Situação', ver: (r) => <Selo texto={r.ativo ? 'Ativa' : 'Inativa'} tom={r.ativo ? 'ok' : 'neutro'} /> },
      ]}
      valoresNovos={{ nome: '', categoria: '', descricao: '', url: 'https://', acesso: '', responsavel: '', icone: 'auto', logo: '', ativo: true }}
      paraForm={(r) => ({ nome: r.nome, categoria: r.categoria, descricao: r.descricao, url: r.url, acesso: r.acesso, responsavel: s(r.responsavel), icone: r.icone === 'users' ? 'pessoas' : r.icone === 'apps' ? 'auto' : r.icone, logo: s(r.logo), ativo: !!r.ativo })}
    />
  );
}

/** Aba Aplicativos: o catálogo (abrir e favoritar) para quem gere o portal; o administrador também cadastra os aplicativos. */
function Aplicativos({ perfil, busca, limparBusca, favoritos, alternarFavorito }: { perfil: PerfilAcesso; busca: string; limparBusca: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void }) {
  const [parte, setParte] = useState<'catalogo' | 'cadastro'>('catalogo');
  return (
    <>
      {perfil === 'admin' && (
        <div className="pilulas filtros" role="group" aria-label="Aplicativos">
          <button aria-pressed={parte === 'catalogo'} onClick={() => setParte('catalogo')}>Catálogo</button>
          <button aria-pressed={parte === 'cadastro'} onClick={() => setParte('cadastro')}>Cadastro (administrador)</button>
        </div>
      )}
      {parte === 'catalogo' || perfil !== 'admin'
        ? <Aplicacoes semCabecalho busca={busca} limparBusca={limparBusca} favoritos={favoritos} alternarFavorito={alternarFavorito} />
        : <CadastroAplicacoes />}
    </>
  );
}

type AbaPub = 'comunicados' | 'banners' | 'documentos' | 'destaques' | 'contatos' | 'aplicacoes';
const ABAS_PUBLICAR: [AbaPub, string][] = [
  ['comunicados', 'Comunicados'], ['banners', 'Banners (Novidades)'], ['documentos', 'Documentos'], ['destaques', 'Colaboradores Destaque'], ['contatos', 'Contatos'], ['aplicacoes', 'Aplicativos'],
];

/** Publicar: editor e admin cuidam do conteúdo do portal (comunicados, documentos, colaboradores destaque, contatos e aplicativos). */
export function Publicar({ perfil, aba: pedida, aoMudarAba, busca, limparBusca, favoritos, alternarFavorito }: {
  perfil: PerfilAcesso; aba?: string; aoMudarAba: (a: string) => void; busca: string; limparBusca: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void;
}) {
  const aba: AbaPub = ABAS_PUBLICAR.find(([id]) => id === pedida)?.[0] ?? ABAS_PUBLICAR[0][0];
  return (
    <>
      <Cabecalho titulo="Publicar" sub="Publique comunicados, banners, documentos, colaboradores destaque, contatos e aplicativos." />
      <div className="abas abas-gestao" role="tablist" aria-label="O que publicar">
        {ABAS_PUBLICAR.map(([id, nome]) => <button key={id} role="tab" aria-selected={aba === id} onClick={() => aoMudarAba(id)}>{nome}</button>)}
      </div>
      {aba === 'comunicados' && <Comunicados />}
      {aba === 'banners' && <Banners />}
      {aba === 'documentos' && <Documentos />}
      {aba === 'destaques' && <Destaques />}
      {aba === 'contatos' && <Contatos />}
      {aba === 'aplicacoes' && <Aplicativos perfil={perfil} busca={busca} limparBusca={limparBusca} favoritos={favoritos} alternarFavorito={alternarFavorito} />}
    </>
  );
}

type AbaCfg = 'usuarios' | 'perfis' | 'auditoria';
const ABAS_CONFIG: [AbaCfg, string][] = [['usuarios', 'Usuários'], ['perfis', 'Perfis'], ['auditoria', 'Auditoria']];
const PERFIS_INFO: [string, string, string][] = [
  ['Administrador', 'admin', 'Tudo o que o editor faz, mais usuários, cadastro de aplicativos, apagar itens publicados e auditoria.'],
  ['Editor', 'editor', 'Publica e edita comunicados, documentos, colaboradores destaque e contatos, e vê o catálogo de aplicativos.'],
  ['Consulta', 'consulta', 'Só lê o portal: comunicados, documentos, aplicativos e contatos.'],
];

function Perfis() {
  return (
    <section className="cartao-sec">
      <p className="suave">Cada usuário tem um perfil. Para mudar o perfil de alguém, use a aba Usuários.</p>
      <div className="rolagem"><table className="dados">
        <thead><tr><th>Perfil</th><th>Código</th><th>O que pode fazer</th></tr></thead>
        <tbody>{PERFIS_INFO.map(([nome, cod, desc]) => <tr key={cod}><td data-rotulo="Perfil"><b>{nome}</b></td><td data-rotulo="Código">{cod}</td><td data-rotulo="O que pode fazer">{desc}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

/** Configurações (só administrador): usuários, perfis e auditoria. */
export function Configuracoes({ aba: pedida, aoMudarAba }: { aba?: string; aoMudarAba: (a: string) => void }) {
  const aba: AbaCfg = ABAS_CONFIG.find(([id]) => id === pedida)?.[0] ?? ABAS_CONFIG[0][0];
  return (
    <>
      <Cabecalho titulo="Configurações" sub="Usuários, perfis de acesso e auditoria do portal." />
      <div className="abas abas-gestao" role="tablist" aria-label="Configurações">
        {ABAS_CONFIG.map(([id, nome]) => <button key={id} role="tab" aria-selected={aba === id} onClick={() => aoMudarAba(id)}>{nome}</button>)}
      </div>
      {aba === 'perfis' ? <Perfis /> : <Administracao parte={aba} />}
    </>
  );
}
