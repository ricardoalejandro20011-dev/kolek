import 'server-only';
import crypto from 'node:crypto';

/**
 * Cifrado simétrico (AES-256-GCM) para credenciales de integraciones que
 * viven en `payment_provider_connections` (access/refresh tokens de
 * Mercado Pago obtenidos por OAuth). Nunca se guardan en texto plano.
 *
 * La llave sale de INTEGRATION_ENCRYPTION_KEY (32+ caracteres). Sin ella,
 * `encriptar()` truena a propósito — preferimos que falle guardar una
 * conexión real a guardarla sin cifrar. El resto de la app (modo mock)
 * nunca llama a esta función.
 */
function obtenerLlave(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY no está configurada (o mide menos de 32 caracteres). ' +
        'No se pueden cifrar/leer credenciales de integraciones reales sin ella.',
    );
  }
  // Derivamos una llave de 32 bytes exactos sin importar el largo del secreto de entrada.
  return crypto.createHash('sha256').update(raw).digest();
}

const ALGORITMO = 'aes-256-gcm';

/** Devuelve "iv:tag:ciphertext" en base64url, listo para guardar en una columna text. */
export function encriptar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, obtenerLlave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, cifrado].map((b) => b.toString('base64url')).join(':');
}

export function desencriptar(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Payload cifrado con formato inválido');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITMO,
    obtenerLlave(),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const claro = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return claro.toString('utf8');
}

/** ¿Está configurada la llave de cifrado? Útil para decidir si ofrecer OAuth real. */
export function cifradoDisponible(): boolean {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  return Boolean(raw && raw.length >= 32);
}
