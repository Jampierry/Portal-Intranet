import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * "Quem recebe": todos ou só os departamentos marcados. Só por departamento, de propósito:
 * escolher pessoas uma a uma quebraria o anonimato das pesquisas.
 */
export function CampoPublico({ valor, mudar }: { valor: unknown; mudar: (v: number[]) => void }) {
  const marcados = Array.isArray(valor) ? (valor as number[]) : [];
  const [lista, setLista] = useState<{ id: number; nome: string }[] | null>(null);
  useEffect(() => { api<{ id: number; nome: string }[]>('/api/departamentos').then(setLista).catch(() => setLista([])); }, []);
  const alternar = (id: number) => mudar(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id]);
  return (
    <fieldset className="publico-campo">
      <legend>Quem recebe</legend>
      <label className="publico-todos">
        <input type="radio" name="publico-modo" checked={marcados.length === 0} onChange={() => mudar([])} /> Todos os colaboradores
      </label>
      <label className="publico-todos">
        <input type="radio" name="publico-modo" checked={marcados.length > 0} onChange={() => { if (marcados.length === 0 && lista && lista[0]) mudar([lista[0].id]); }} disabled={!lista || lista.length === 0} /> Só alguns departamentos
      </label>
      {marcados.length > 0 && (
        <div className="publico-lista" role="group" aria-label="Departamentos">
          {(lista ?? []).map((d) => (
            <label key={d.id} className="publico-item"><input type="checkbox" checked={marcados.includes(d.id)} onChange={() => alternar(d.id)} /> {d.nome}</label>
          ))}
        </div>
      )}
      <small>Quem não tem departamento no cadastro só recebe o que é para todos. O departamento de cada pessoa é definido em Configurações › Usuários.</small>
    </fieldset>
  );
}
