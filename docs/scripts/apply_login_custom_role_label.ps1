# Fase 9.13.1K — Label de função personalizada no login
#
# Ajusta a tela de escolha de loja para priorizar custom_role_name quando a RPC retornar esse campo.
# Não altera backend. Se get_login_store_options ainda não retornar custom_role_name,
# a tela continua usando o papel base traduzido.

$ErrorActionPreference = 'Stop'

$loginPath = 'src/pages/initial/auth/Login.tsx'
$typePath = 'src/types/security.ts'

if (!(Test-Path $loginPath)) { throw "Arquivo não encontrado: $loginPath" }
if (!(Test-Path $typePath)) { throw "Arquivo não encontrado: $typePath" }

$login = Get-Content -Path $loginPath -Raw
$types = Get-Content -Path $typePath -Raw

# 1) Atualiza tipo LoginStoreOption para aceitar campos de função personalizada.
if ($types -notmatch 'custom_role_name') {
    $oldTypeBlock = @'
export type LoginStoreOption = {
  store_id: string;
  store_name: string;
  store_slug: string | null;
  store_logo_url: string | null;
  role: string;
  status: string;
  status_reason?: string | null;
  is_owner: boolean;
  is_primary_owner: boolean;
  access_blocked?: boolean | null;
  access_message?: string | null;
  sort_order: number;
};
'@

    $newTypeBlock = @'
export type LoginStoreOption = {
  store_id: string;
  store_name: string;
  store_slug: string | null;
  store_logo_url: string | null;
  role: string;
  custom_role_id?: string | null;
  custom_role_name?: string | null;
  custom_role_base_role?: string | null;
  status: string;
  status_reason?: string | null;
  is_owner: boolean;
  is_primary_owner: boolean;
  access_blocked?: boolean | null;
  access_message?: string | null;
  sort_order: number;
};
'@

    if (!$types.Contains($oldTypeBlock)) {
        throw 'Trecho LoginStoreOption não encontrado em src/types/security.ts'
    }

    $types = $types.Replace($oldTypeBlock, $newTypeBlock)
}

# 2) Ajusta formatLoginRole para receber a opção completa e priorizar custom_role_name.
if ($login -match 'function formatLoginRole\(role: string \| null \| undefined\): string') {
    $oldFunction = @'
function formatLoginRole(role: string | null | undefined): string {
  const labels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gerente',
    stock_operator: 'Operador de estoque',
    cashier: 'Caixa',
    sales: 'Vendas',
    staff: 'Equipe',
    viewer: 'Visualizador',
  };

  return role ? labels[role] ?? role : 'Não definido';
}
'@

    $newFunction = @'
function formatLoginRole(option: LoginStoreOption): string {
  const customRoleName = option.custom_role_name?.trim();

  if (customRoleName) {
    return customRoleName;
  }

  const labels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gerente',
    stock_operator: 'Operador de estoque',
    cashier: 'Caixa',
    sales: 'Vendas',
    staff: 'Equipe',
    viewer: 'Visualizador',
  };

  return option.role ? labels[option.role] ?? option.role : 'Não definido';
}
'@

    if (!$login.Contains($oldFunction)) {
        throw 'Trecho formatLoginRole não encontrado em Login.tsx'
    }

    $login = $login.Replace($oldFunction, $newFunction)
}

# 3) Ajusta chamada no JSX.
$login = $login.Replace('<span>{formatLoginRole(option.role)}</span>', '<span>{formatLoginRole(option)}</span>')

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $loginPath), $login, $utf8NoBom)
[System.IO.File]::WriteAllText((Resolve-Path $typePath), $types, $utf8NoBom)

Write-Host "Login ajustado para priorizar custom_role_name quando disponível." -ForegroundColor Green
