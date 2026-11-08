import { useContext, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { MESES_LONGOS, dataCurta } from '../dados';
import { Crud, JanelaForm, PermissoesCtx, Selo } from './Crud';

const s = (v: string | null | undefined) => v ?? '';
const AVISO_LGPD = 'Só aparece no portal quem estiver com "Autorizou divulgar" marcado (LGPD). Registre a autorização antes de marcar.';

interface Aniv { id: number; nome: string; area: string; dia: number; mes: number; foto: string | null; autorizado: number }
interface Resultado { novos: number; atualizados: number; erros: string[]; total_erros: number }

/** Lê "dd/mm", "dd/mm/aaaa" ou "aaaa-mm-dd" e devolve só dia e mês (o ano de nascimento não é guardado). */
function diaMesDe(txt: string): { dia: number; mes: number } | null {
  const t = txt.trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-]\d{2,4})?$/.exec(t);
  if (m) return { dia: Number(m[1]), mes: Number(m[2]) };
  m = /^\d{4}-(\d{1,2})-(\d{1,2})/.exec(t);
  return m ? { dia: Number(m[2]), mes: Number(m[1]) } : null;
}
/** Planilha CSV (separada por ; , ou tab): nome, área e aniversário. A linha de cabeçalho, se houver, é ignorada. */
export function lerPlanilha(texto: string): { itens: { nome: string; area: string; dia: number; mes: number }[]; ignoradas: number } {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const itens: { nome: string; area: string; dia: number; mes: number }[] = [];
  let ignoradas = 0;
  linhas.forEach((l, i) => {
    const sep = l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',';
    const [nome = '', area = '', aniv = ''] = l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    const dm = diaMesDe(aniv);
    if (!dm) { if (i > 0) ignoradas++; return; } // a 1ª linha sem data costuma ser o cabeçalho
    itens.push({ nome, area, ...dm });
  });
  return { itens, ignoradas };
}

function ImportarAniversariantes({ aoFechar, aoConcluir }: { aoFechar: () => void; aoConcluir: (msg: string) => void }) {
  const [txt, setTxt] = useState('');
  const [ok, setOk] = useState(false);
  const lido = lerPlanilha(txt);
  const lerArquivo = async (f?: File) => { if (f) setTxt(await f.text()); };
  return (
    <JanelaForm titulo="Importar aniversariantes (planilha)" rotuloEnviar={`Importar ${lido.itens.length || ''}`.trim()} aoFechar={aoFechar}
      aoEnviar={async () => {
        const r = await api<Resultado>('/api/gestao/aniversariantes/importar', { itens: lido.itens, autorizado: ok });
        aoConcluir(`Importação: ${r.novos} novo(s), ${r.atualizados} atualizado(s)${r.total_erros ? `, ${r.total_erros} linha(s) com problema (${r.erros.slice(0, 3).join('; ')})` : ''}.`);
      }}>
      <p className="suave" style={{ marginTop: 0 }}>Colunas, nesta ordem: <b>nome</b>, <b>área</b>, <b>aniversário</b> (dd/mm). Separe por ponto e vírgula, vírgula ou tab. Se a pessoa já existir (mesmo nome e dia), a área é atualizada. O ano de nascimento, se vier, é descartado.</p>
      <label>Arquivo CSV (opcional)<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => { void lerArquivo(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <label>Ou cole as linhas aqui
        <textarea rows={8} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'Ana Souza;Costura;12/03\nBruno Lima;Corte;05/11'} />
      </label>
      <p className="suave" role="status">{lido.itens.length} linha(s) válida(s){lido.ignoradas ? `; ${lido.ignoradas} ignorada(s) por falta de data` : ''}.</p>
      <label className="linha"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />O RH tem a autorização dessas pessoas para divulgar o aniversário</label>
    </JanelaForm>
  );
}

/** Publicar › Aniversariantes (RH): aparecem no Início, no mês do aniversário. */
export function Aniversariantes() {
  const perms = useContext(PermissoesCtx);
  const [importar, setImportar] = useState(false);
  const [aviso, setAviso] = useState('');
  const [versao, setVersao] = useState(0);
  const podeCriar = perms === null || perms.includes('pub.aniversariantes.criar');
  return (
    <>
      {podeCriar && (
        <div className="barra" style={{ marginBottom: 8 }}>
          <span className="suave">Cadastre um por um ou importe a planilha do RH.</span>
          <button className="btn btn-sec" onClick={() => setImportar(true)}><Icone nome="mais" tamanho={15} /> Importar planilha</button>
        </div>
      )}
      {aviso && <p className="ok" role="status">{aviso}</p>}
      <Crud<Aniv> key={versao} base="/api/gestao/aniversariantes" rotuloItem="aniversariante" idDe={(r) => r.id}
        introducao={`Aparecem no Início, no mês do aniversário (só dia e mês, sem a idade). ${AVISO_LGPD}`}
        campos={[
          { chave: 'foto', rotulo: 'Foto (opcional)', tipo: 'imagem', dica: 'Foto quadrada, PNG, JPG, WebP ou GIF, até 5 MB. Sem foto, aparecem as iniciais.' },
          { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, metade: true },
          { chave: 'area', rotulo: 'Área', obrigatorio: true, max: 60, metade: true },
          { chave: 'dia', rotulo: 'Dia do aniversário', tipo: 'select', opcoes: Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)] as [string, string]), metade: true },
          { chave: 'mes', rotulo: 'Mês do aniversário', tipo: 'select', opcoes: MESES_LONGOS.map((m, i) => [String(i + 1), m] as [string, string]), metade: true },
          { chave: 'autorizado', rotulo: 'Autorizou divulgar', tipo: 'check', dica: AVISO_LGPD },
        ]}
        colunas={[
          { titulo: 'Nome', ver: (r) => r.nome },
          { titulo: 'Área', ver: (r) => r.area },
          { titulo: 'Aniversário', ver: (r) => `${String(r.dia).padStart(2, '0')}/${String(r.mes).padStart(2, '0')}`, ordem: (r) => r.mes * 100 + r.dia },
          { titulo: 'Divulgação', ver: (r) => (r.autorizado ? <Selo texto="Autorizado" tom="ok" /> : <Selo texto="Não aparece" tom="aviso" />) },
        ]}
        valoresNovos={{ foto: '', nome: '', area: '', dia: '1', mes: String(new Date().getMonth() + 1), autorizado: false }}
        paraForm={(r) => ({ foto: s(r.foto), nome: r.nome, area: r.area, dia: String(r.dia), mes: String(r.mes), autorizado: !!r.autorizado })}
      />
      {importar && <ImportarAniversariantes aoFechar={() => setImportar(false)} aoConcluir={(m) => { setAviso(m); setVersao((v) => v + 1); setImportar(false); }} />}
    </>
  );
}

interface Novo { id: number; nome: string; area: string; funcao: string | null; entrada: string; mensagem: string | null; foto: string | null; autorizado: number }
/** Publicar › Novos colaboradores (RH): aparecem no Início por 30 dias a partir da data de entrada. */
export function NovosColaboradores() {
  return (
    <Crud<Novo> base="/api/gestao/novos" rotuloItem="novo colaborador" idDe={(r) => r.id}
      introducao={`Aparecem no Início por 30 dias a partir da data de entrada. ${AVISO_LGPD}`}
      campos={[
        { chave: 'foto', rotulo: 'Foto (opcional)', tipo: 'imagem', dica: 'Foto quadrada, PNG, JPG, WebP ou GIF, até 5 MB. Sem foto, aparecem as iniciais.' },
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, metade: true },
        { chave: 'area', rotulo: 'Área', obrigatorio: true, max: 60, metade: true },
        { chave: 'funcao', rotulo: 'Função (opcional)', max: 60, metade: true },
        { chave: 'entrada', rotulo: 'Data de entrada', tipo: 'data', obrigatorio: true, metade: true },
        { chave: 'mensagem', rotulo: 'Mensagem de boas-vindas (opcional)', tipo: 'area', max: 200 },
        { chave: 'autorizado', rotulo: 'Autorizou divulgar', tipo: 'check', dica: AVISO_LGPD },
      ]}
      colunas={[
        { titulo: 'Nome', ver: (r) => r.nome },
        { titulo: 'Área', ver: (r) => r.area },
        { titulo: 'Entrada', ver: (r) => dataCurta(r.entrada), ordem: (r) => r.entrada },
        { titulo: 'Divulgação', ver: (r) => (r.autorizado ? <Selo texto="Autorizado" tom="ok" /> : <Selo texto="Não aparece" tom="aviso" />) },
      ]}
      valoresNovos={{ foto: '', nome: '', area: '', funcao: '', entrada: new Date().toISOString().slice(0, 10), mensagem: '', autorizado: false }}
      paraForm={(r) => ({ foto: s(r.foto), nome: r.nome, area: r.area, funcao: s(r.funcao), entrada: r.entrada, mensagem: s(r.mensagem), autorizado: !!r.autorizado })}
    />
  );
}
