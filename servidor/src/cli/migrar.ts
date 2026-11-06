import { config } from '../config.ts';
import { abrirBanco, migrar } from '../db.ts';

const novas = migrar(abrirBanco(config.caminhoBanco), config.pastaMigracoes);
console.log(novas.length ? `Aplicadas: ${novas.join(', ')}` : 'Banco já está atualizado.');
