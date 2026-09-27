export type OptmaPayWebhookVerification = {
  ok: boolean;
  reason?: 'invalid_timestamp' | 'replay' | 'invalid_signature_format' | 'invalid_signature';
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function importHmacKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

export async function hmacSha256Hex(secret: string, input: string) {
  const key = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(signature));
}

async function verifyHmacSha256Hex(secret: string, input: string, providedHex: string) {
  const signature = hexToBytes(providedHex);
  if (!signature) return false;
  const key = await importHmacKey(secret, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(input));
}

export async function signOptmaPayWebhook(
  secret: string,
  timestamp: number | string,
  eventId: string,
  rawBody: string,
) {
  const digest = await hmacSha256Hex(secret, `${timestamp}.${eventId}.${rawBody}`);
  return `v1=${digest}`;
}

export async function verifyOptmaPayWebhook(input: {
  secret: string;
  signatureHeader: string;
  timestampHeader: string;
  eventId: string;
  rawBody: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<OptmaPayWebhookVerification> {
  const timestamp = Number.parseInt(input.timestampHeader, 10);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'invalid_timestamp' };

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return { ok: false, reason: 'replay' };

  if (!input.signatureHeader.startsWith('v1=')) {
    return { ok: false, reason: 'invalid_signature_format' };
  }

  const provided = input.signatureHeader.slice(3).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    return { ok: false, reason: 'invalid_signature_format' };
  }

  const valid = await verifyHmacSha256Hex(
    input.secret,
    `${timestamp}.${input.eventId}.${input.rawBody}`,
    provided,
  );

  return valid ? { ok: true } : { ok: false, reason: 'invalid_signature' };
}

export function buildOptmaMenuPixReference(storeId: string, intentId: string) {
  if (!UUID_RE.test(storeId) || !UUID_RE.test(intentId)) {
    throw new Error('invalid_optmamenu_pix_reference_ids');
  }
  return `optmamenu:${storeId}:${intentId}:pix`;
}

export function parseOptmaMenuPixReference(reference: string) {
  const parts = reference.split(':');
  if (
    parts.length !== 4 ||
    parts[0] !== 'optmamenu' ||
    parts[3] !== 'pix' ||
    !UUID_RE.test(parts[1]) ||
    !UUID_RE.test(parts[2])
  ) {
    return null;
  }

  return { storeId: parts[1], intentId: parts[2], method: 'pix' as const };
}
