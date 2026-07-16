export type PermissionMode = 'denied' | 'read' | 'manage';

type PermissionModeInput = {
  canView: boolean;
  canManage: boolean;
};

export const DEFAULT_PERMISSION_READ_ONLY_MESSAGE =
  'Você pode visualizar estas informações, mas não tem permissão para executar alterações.';

export function getPermissionMode({ canView, canManage }: PermissionModeInput): PermissionMode {
  if (!canView) return 'denied';
  if (canManage) return 'manage';
  return 'read';
}

export function isPermissionReadOnly(input: PermissionModeInput) {
  return getPermissionMode(input) === 'read';
}

export function canExecutePermissionAction(input: PermissionModeInput) {
  return getPermissionMode(input) === 'manage';
}

export function getPermissionReadOnlyMessage(customMessage?: string | null) {
  return customMessage?.trim() || DEFAULT_PERMISSION_READ_ONLY_MESSAGE;
}

export function getPermissionDisabledProps(
  input: PermissionModeInput,
  customMessage?: string | null
) {
  const readOnly = isPermissionReadOnly(input);

  return {
    disabled: readOnly || !input.canView,
    'aria-disabled': readOnly || !input.canView,
    title: readOnly ? getPermissionReadOnlyMessage(customMessage) : undefined,
  };
}
