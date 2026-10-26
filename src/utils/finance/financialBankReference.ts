/**
 * A bank reference identifies a real institution/account for bookkeeping.
 * It is NOT a bank API connection or an Open Finance consent.
 * Never store access tokens, passwords, full account numbers or CPF here.
 */
export type BankReference = {
  institution: string;
  account_last4: string;
  connection_mode: 'manual';
};

export function normalizeBankReference(
  institution: string,
  accountLast4: string,
): BankReference | null {
  const cleanInstitution = institution.trim().replace(/\s+/g, ' ');
  const rawLast4 = accountLast4.trim();
  if (!cleanInstitution && !rawLast4) return null;
  if (cleanInstitution.length < 2 || cleanInstitution.length > 90)
    throw new Error('Informe a instituição financeira (2 a 90 caracteres).');
  if (rawLast4 && !/^\d{4}$/.test(rawLast4))
    throw new Error('Informe apenas os quatro últimos dígitos da conta, ou deixe em branco.');
  return {
    institution: cleanInstitution,
    account_last4: rawLast4,
    connection_mode: 'manual',
  };
}
export function bankReferenceLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return 'Sem identificação de banco';
  const bank = value as Partial<BankReference>;
  const name = typeof bank.institution === 'string' ? bank.institution : '';
  const ending = typeof bank.account_last4 === 'string' && /^\d{4}$/.test(bank.account_last4)
    ? ` •••• ${bank.account_last4}` : '';
  return name ? `${name}${ending} · cadastro manual (sem sincronização bancária)` : 'Sem identificação de banco';
}
