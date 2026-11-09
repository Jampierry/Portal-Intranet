// Liga os dados de EXEMPLO (empresa fictícia "Aurora Esportes"): tudo é gravado no banco, imagens inclusive.
// Pode repetir sem duplicar. Para desligar: Configurações › Dados de exemplo (administrador) ou `npm run demo -- desligar`.
import { config } from '../config.ts';
import { abrirBanco, migrar } from '../db.ts';
import { ativarExemplo, desativarExemplo } from '../../../modulos/demonstracao/api/pacote.ts';

const db = abrirBanco(config.caminhoBanco);
migrar(db, config.pastaMigracoes);
const e = process.argv.includes('desligar') ? desativarExemplo(db) : ativarExemplo(db, { producao: config.producao });
console.log(e.ativo ? `Dados de exemplo ligados (${e.total} registros). Logins: ${e.usuarios.map((u) => u.login).join(', ')}` : 'Dados de exemplo desligados.');
