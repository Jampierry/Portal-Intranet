import { Crud, Selo } from './Crud';
import { Administracao } from './Administracao';
import { Cabecalho } from '../Cabecalho';
import { dataCurta, useLista } from '../dados';
import type { PerfilAcesso } from '../sessao';

const s = (v: string | null | undefined) => v ?? '';
const SIT_COM: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { publicado: ['ok', 'Publicado'], rascunho: ['aviso', 'Rascunho'], arquivado: ['neutro', 'Arquivado'] };

interface Com { id: number; titulo: string; resumo: string; corpo: string | null; categoria: string; prioridade: string; status: string; exibir_de: string | null; exibir_ate: string | null; publicado_em: string | null }
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
      valoresNovos={{ titulo: '', resumo: '', corpo: '', categoria: '', prioridade: 'normal', status: 'rascunho', exibir_de: '', exibir_ate: '' }}
      paraForm={(r) => ({ titulo: r.titulo, resumo: r.resumo, corpo: s(r.corpo), categoria: r.categoria, prioridade: r.prioridade, status: r.status, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) })}
      podeApagar={() => true}
      acoesExtra={(r, salvar) => {
        const base = { titulo: r.titulo, resumo: r.resumo, corpo: s(r.corpo), categoria: r.categoria, prioridade: r.prioridade, exibir_de: s(r.exibir_de), exibir_ate: s(r.exibir_ate) };
        return r.status === 'publicado'
          ? <button className="btn btn-sec btn-pequeno" onClick={() => void salvar({ ...base, status: 'arquivado' })}>Arquivar</button>
          : <button className="btn btn-verde btn-pequeno" onClick={() => void salvar({ ...base, status: 'publicado' })}>Publicar</button>;
      }}
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

interface App { slug: string; nome: string; descricao: string; categoria: string; url: string; acesso: string; icone: string; responsavel: string | null; ativo: number }
function Aplicacoes() {
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
        { chave: 'icone', rotulo: 'Ícone', tipo: 'select', opcoes: [['apps', 'Aplicações'], ['users', 'Pessoas']], metade: true },
        { chave: 'ativo', rotulo: 'Ativa (aparece no portal)', tipo: 'check' },
      ]}
      colunas={[
        { titulo: 'Nome', ver: (r) => r.nome },
        { titulo: 'Categoria', ver: (r) => r.categoria },
        { titulo: 'Endereço', ver: (r) => <span className="trunca" title={r.url}>{r.url}</span> },
        { titulo: 'Situação', ver: (r) => <Selo texto={r.ativo ? 'Ativa' : 'Inativa'} tom={r.ativo ? 'ok' : 'neutro'} /> },
      ]}
      valoresNovos={{ nome: '', categoria: '', descricao: '', url: 'https://', acesso: '', responsavel: '', icone: 'apps', ativo: true }}
      paraForm={(r) => ({ nome: r.nome, categoria: r.categoria, descricao: r.descricao, url: r.url, acesso: r.acesso, responsavel: s(r.responsavel), icone: r.icone === 'users' ? 'users' : 'apps', ativo: !!r.ativo })}
    />
  );
}

type Aba = 'comunicados' | 'documentos' | 'destaques' | 'contatos' | 'aplicacoes' | 'usuarios' | 'auditoria';
const ABAS: [Aba, string, PerfilAcesso[]][] = [
  ['comunicados', 'Comunicados', ['admin', 'editor']], ['documentos', 'Documentos', ['admin', 'editor']], ['destaques', 'Pessoas em destaque', ['admin', 'editor']], ['contatos', 'Contatos', ['admin', 'editor']],
  ['aplicacoes', 'Aplicações', ['admin']], ['usuarios', 'Usuários', ['admin']], ['auditoria', 'Auditoria', ['admin']],
];

/** Gestão do portal: editor cuida do conteúdo; o admin master também cria usuários, aplicações e vê a auditoria. */
export function Gestao({ perfil, aba: pedida, aoMudarAba }: { perfil: PerfilAcesso; aba?: string; aoMudarAba: (a: string) => void }) {
  const abas = ABAS.filter(([, , quem]) => quem.includes(perfil));
  const aba: Aba = abas.find(([id]) => id === pedida)?.[0] ?? abas[0][0];
  return (
    <>
      <Cabecalho titulo="Gestão" sub={perfil === 'admin' ? 'Conteúdo, aplicações, usuários e auditoria do portal.' : 'Publique comunicados, documentos e reconhecimentos.'} />
      <div className="abas abas-gestao" role="tablist" aria-label="Áreas da gestão">
        {abas.map(([id, nome]) => <button key={id} role="tab" aria-selected={aba === id} onClick={() => aoMudarAba(id)}>{nome}</button>)}
      </div>
      {aba === 'comunicados' && <Comunicados />}
      {aba === 'documentos' && <Documentos />}
      {aba === 'destaques' && <Destaques />}
      {aba === 'contatos' && <Contatos />}
      {aba === 'aplicacoes' && <Aplicacoes />}
      {(aba === 'usuarios' || aba === 'auditoria') && <Administracao parte={aba} />}
    </>
  );
}
