import { describe, expect, it } from 'vitest';
import {
  buildOptmaMenuPixReference,
  parseOptmaMenuPixReference,
  signOptmaPayWebhook,
  verifyOptmaPayWebhook,
} from '../../../supabase/functions/_shared/optmapayWebhook';

describe('OptmaPay webhook contract', () => {
  it('aceita HMAC v1 válido e rejeita payload adulterado', async () => {
    const secret = 'whsec_optmapay_test_secret_123456789';
    const timestamp = 1_797_000_000;
    const eventId = '6f596265-23ff-4dd8-bf2c-f5c465fb93b9';
    const rawBody = JSON.stringify({
      id: eventId,
      event: 'pix.paid',
      environment: 'sandbox',
      realMoney: false,
      data: { amount: 26 },
    });

    const signature = await signOptmaPayWebhook(secret, timestamp, eventId, rawBody);
    const valid = await verifyOptmaPayWebhook({
      secret,
      signatureHeader: signature,
      timestampHeader: String(timestamp),
      eventId,
      rawBody,
      nowSeconds: timestamp + 10,
    });
    expect(valid).toEqual({ ok: true });

    const invalid = await verifyOptmaPayWebhook({
      secret,
      signatureHeader: signature,
      timestampHeader: String(timestamp),
      eventId,
      rawBody: rawBody.replace('26', '27'),
      nowSeconds: timestamp + 10,
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.reason).toBe('invalid_signature');
  });

  it('rejeita timestamp fora da janela de replay', async () => {
    const timestamp = 1_797_000_000;
    const eventId = '6f596265-23ff-4dd8-bf2c-f5c465fb93b9';
    const signature = await signOptmaPayWebhook(
      'whsec_optmapay_test_secret',
      timestamp,
      eventId,
      '{}',
    );

    const result = await verifyOptmaPayWebhook({
      secret: 'whsec_optmapay_test_secret',
      signatureHeader: signature,
      timestampHeader: String(timestamp),
      eventId,
      rawBody: '{}',
      nowSeconds: timestamp + 301,
    });

    expect(result).toEqual({ ok: false, reason: 'replay' });
  });

  it('gera e interpreta referência estável do intent Pix', () => {
    const storeId = '9f4ad6ca-a513-4e9a-8e48-2df55e0c6285';
    const intentId = '77c3fcce-94ce-4a7e-9518-4f20d83c98ce';
    const reference = buildOptmaMenuPixReference(storeId, intentId);

    expect(reference).toBe(`optmamenu:${storeId}:${intentId}:pix`);
    expect(parseOptmaMenuPixReference(reference)).toEqual({
      storeId,
      intentId,
      method: 'pix',
    });
    expect(parseOptmaMenuPixReference('optmamenu:fake:fake:pix')).toBeNull();
  });
});
