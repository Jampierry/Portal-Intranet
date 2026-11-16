// Autenticador de mentira para os testes: faz o papel do aparelho (cria a credencial e assina) com node:crypto, sem navegador.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

const b64u = (b: Uint8Array | Buffer) => Buffer.from(b).toString('base64url');

// CBOR mínimo (o que o WebAuthn precisa): inteiros, bytes, texto e mapas.
function cabeca(tipo: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(tipo << 5) | n]);
  if (n < 256) return Buffer.from([(tipo << 5) | 24, n]);
  return Buffer.from([(tipo << 5) | 25, n >> 8, n & 255]);
}
type Cbor = number | Buffer | string | Map<Cbor, Cbor>;
function cbor(v: Cbor): Buffer {
  if (typeof v === 'number') return v >= 0 ? cabeca(0, v) : cabeca(1, -1 - v);
  if (typeof v === 'string') { const t = Buffer.from(v); return Buffer.concat([cabeca(3, t.length), t]); }
  if (Buffer.isBuffer(v)) return Buffer.concat([cabeca(2, v.length), v]);
  return Buffer.concat([cabeca(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

export class AutenticadorFalso {
  readonly idCredencial = randomBytes(16);
  private readonly par = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  contador = 0;
  private readonly rpID: string;
  private readonly origem: string;
  constructor(rpID: string, origem: string) { this.rpID = rpID; this.origem = origem; }

  private hashRp() { return createHash('sha256').update(this.rpID).digest(); }
  private cliente(tipo: string, challenge: string) { return Buffer.from(JSON.stringify({ type: tipo, challenge, origin: this.origem, crossOrigin: false })); }

  /** Resposta de cadastro (attestation "none") para as opções recebidas do servidor. */
  cadastro(challenge: string) {
    const jwk = this.par.publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    const cose = cbor(new Map<Cbor, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
    const tam = Buffer.alloc(2); tam.writeUInt16BE(this.idCredencial.length);
    const dados = Buffer.concat([this.hashRp(), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), tam, this.idCredencial, cose]); // UP | UV | AT
    const objeto = cbor(new Map<Cbor, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', dados]]));
    return {
      id: b64u(this.idCredencial), rawId: b64u(this.idCredencial), type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform',
      response: { clientDataJSON: b64u(this.cliente('webauthn.create', challenge)), attestationObject: b64u(objeto), transports: ['internal'] },
    };
  }

  /** Resposta de entrada: assina o desafio (como o aparelho faz depois da digital ou do rosto). */
  entrada(challenge: string, { verificado = true }: { verificado?: boolean } = {}) {
    this.contador += 1;
    const c = Buffer.alloc(4); c.writeUInt32BE(this.contador);
    const dados = Buffer.concat([this.hashRp(), Buffer.from([verificado ? 0x05 : 0x01]), c]); // UP | UV
    const cliente = this.cliente('webauthn.get', challenge);
    const assinatura = sign('sha256', Buffer.concat([dados, createHash('sha256').update(cliente).digest()]), this.par.privateKey);
    return {
      id: b64u(this.idCredencial), rawId: b64u(this.idCredencial), type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform',
      response: { clientDataJSON: b64u(cliente), authenticatorData: b64u(dados), signature: b64u(assinatura) },
    };
  }
}
