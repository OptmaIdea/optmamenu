# Fase 9.13.1K — Labels amigáveis no Meu Histórico
#
# Aplica ajustes localizados em:
# src/pages/private/admin/settings/myHistory/MyHistory.tsx
#
# Versão tolerante:
# - não depende do bloco ACTION_LABELS inteiro estar idêntico;
# - insere tradutores por âncoras menores;
# - substitui o bloco profile_request_* por regex;
# - é idempotente para os tradutores.

$ErrorActionPreference = 'Stop'

$path = 'src/pages/private/admin/settings/myHistory/MyHistory.tsx'

if (!(Test-Path $path)) {
    throw "Arquivo não encontrado: $path"
}

$content = Get-Content -Path $path -Raw

function Replace-Regex-Required {
    param(
        [string]$Current,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Label
    )

    if ($Current -notmatch $Pattern) {
        throw "Trecho não encontrado para substituição: $Label"
    }

    return [regex]::Replace($Current, $Pattern, $Replacement, 1)
}

function Insert-After-Required {
    param(
        [string]$Current,
        [string]$Anchor,
        [string]$Insert,
        [string]$Label
    )

    if (!$Current.Contains($Anchor)) {
        throw "Âncora não encontrada para inserção: $Label"
    }

    return $Current.Replace($Anchor, "$Anchor$Insert")
}

# 1) Adiciona actions de solicitações cadastrais dentro de ACTION_LABELS, se ainda não existirem.
if ($content -notmatch "profile_request_created") {
    $anchor = "  role_permission_updated: 'Permissão por papel alterada',"
    $insert = @'
  profile_request_created: 'Solicitação de alteração cadastral criada',
  profile_request_reviewed: 'Solicitação de alteração cadastral revisada',
  profile_request_approved: 'Solicitação de alteração cadastral aprovada',
  profile_request_rejected: 'Solicitação de alteração cadastral rejeitada',
  profile_request_cancelled: 'Solicitação de alteração cadastral cancelada',
  profile_request_applied: 'Alteração cadastral aplicada',
  profile_request_approved_and_applied: 'Alteração cadastral aprovada e aplicada',
  profile_request_member_confirmed: 'Alteração cadastral confirmada pelo usuário',
'@
    $content = Insert-After-Required -Current $content -Anchor $anchor -Insert "`r`n$insert" -Label 'ACTION_LABELS/profile_request_*'
}

# 2) Insere tradutores depois de ACTION_LABELS, se ainda não existirem.
if ($content -notmatch "PROFILE_REQUEST_TYPE_LABELS") {
    $translatorBlock = @'

const PROFILE_REQUEST_TYPE_LABELS: Record<string, string> = {
  name_change: 'Alteração de nome',
  cpf_change: 'Alteração de CPF',
  birth_date_change: 'Alteração de data de nascimento',
  contact_change: 'Alteração de contato',
  address_change: 'Alteração de endereço',
  additional_info_change: 'Alteração de informação adicional',
};

const PROFILE_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
  applied: 'Aplicada',
  reviewed: 'Revisada',
  awaiting_member_confirmation: 'Aguardando confirmação do usuário',
  correction_requested: 'Correção solicitada',
};

const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: 'Nome completo',
  full_name: 'Nome completo',
  cpf: 'CPF',
  birth_date: 'Data de nascimento',
  email: 'E-mail',
  contact_email: 'E-mail de contato',
  phone: 'Celular',
  phone_number: 'Celular',
  whatsapp: 'WhatsApp',
  fixed_phone: 'Telefone fixo',
  address: 'Endereço',
  street: 'Rua',
  number: 'Número',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'Estado',
  zip_code: 'CEP',
  blood_type: 'Tipo sanguíneo',
};

function humanizeTechnicalLabel(value: string, map: Record<string, string>) {
  const normalized = value.trim();

  if (!normalized) return '';

  return map[normalized] ?? normalized
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function translateRequestType(value: string) {
  return humanizeTechnicalLabel(value, PROFILE_REQUEST_TYPE_LABELS);
}

function translateProfileRequestStatus(value: string) {
  return humanizeTechnicalLabel(value, PROFILE_REQUEST_STATUS_LABELS);
}

function translateProfileField(value: string) {
  return humanizeTechnicalLabel(value, PROFILE_FIELD_LABELS);
}

function translateTechnicalText(value: string) {
  return value
    .replace(/\bname_change\b/g, 'Alteração de nome')
    .replace(/\bcpf_change\b/g, 'Alteração de CPF')
    .replace(/\bbirth_date_change\b/g, 'Alteração de data de nascimento')
    .replace(/\bcontact_change\b/g, 'Alteração de contato')
    .replace(/\baddress_change\b/g, 'Alteração de endereço')
    .replace(/\badditional_info_change\b/g, 'Alteração de informação adicional')
    .replace(/\bapplied\b/g, 'Aplicada')
    .replace(/\bapproved\b/g, 'Aprovada')
    .replace(/\brejected\b/g, 'Rejeitada')
    .replace(/\bcancelled\b/g, 'Cancelada')
    .replace(/\bpending\b/g, 'Pendente')
    .replace(/\bfull_name\b/g, 'Nome completo')
    .replace(/\bname\b/g, 'Nome completo');
}
'@

    $patternActionLabels = "(?s)(const ACTION_LABELS: Record<string, string> = \{.*?\};)"
    $content = Replace-Regex-Required -Current $content -Pattern $patternActionLabels -Replacement "`$1$translatorBlock" -Label 'inserção dos tradutores após ACTION_LABELS'
}

# 3) Substitui bloco profile_request_*.
$profileBlock = @'
  if (action.startsWith('profile_request_')) {
    const requestType =
      getDetailText(details, 'request_type') ??
      getDetailText(metadata, 'request_type') ??
      getDetailText(details, 'type') ??
      getDetailText(metadata, 'type');

    const status =
      getDetailText(details, 'status') ??
      getDetailText(metadata, 'status');

    const field =
      getDetailText(details, 'field') ??
      getDetailText(metadata, 'field') ??
      getDetailText(details, 'field_key') ??
      getDetailText(metadata, 'field_key');

    const oldValue =
      getDetailText(details, 'old_value') ??
      getDetailText(metadata, 'old_value') ??
      getDetailText(details, 'previous_value') ??
      getDetailText(metadata, 'previous_value');

    const newValue =
      getDetailText(details, 'new_value') ??
      getDetailText(metadata, 'new_value') ??
      getDetailText(details, 'requested_value') ??
      getDetailText(metadata, 'requested_value');

    const reason = getDetailText(details, 'reason') ?? getDetailText(metadata, 'reason');
    const adminNotes = getDetailText(details, 'admin_notes') ?? getDetailText(metadata, 'admin_notes');
    const memberFeedback = getDetailText(details, 'member_feedback') ?? getDetailText(metadata, 'member_feedback');
    const description = getDetailText(details, 'description') ?? getDetailText(metadata, 'description');

    const valueChange = field || oldValue || newValue
      ? [
          field ? `${translateProfileField(field)}:` : null,
          oldValue ? `de ${oldValue}` : null,
          newValue ? `para ${newValue}` : null,
        ].filter(Boolean).join(' ')
      : null;

    return [
      requestType ? `Tipo: ${translateRequestType(requestType)}` : null,
      status ? `Status: ${translateProfileRequestStatus(status)}` : null,
      valueChange,
      reason ? `Motivo: ${reason}` : null,
      adminNotes ? `Observação do responsável: ${adminNotes}` : null,
      memberFeedback ? `Resposta do usuário: ${memberFeedback}` : null,
      description ? translateTechnicalText(description) : null,
    ].filter(Boolean).join('\n');
  }
'@

if ($content -notmatch "translateRequestType\(requestType\)") {
    $patternProfile = "(?s)  if \(action\.startsWith\('profile_request_'\)\) \{.*?\n  \}"
    $content = Replace-Regex-Required -Current $content -Pattern $patternProfile -Replacement $profileBlock -Label 'bloco profile_request_*'
}

# 4) Torna fallback geral mais amigável, se ainda não estiver aplicado.
if ($content -notmatch "description \? translateTechnicalText\(description\)") {
    $patternFallback = "(?s)  return \(\s*description \|\|\s*reason \|\|\s*note \|\|\s*title \|\|\s*'Registro de atividade do usuário\.'\s*\);"
    $fallbackBlock = @'
  return (
    (description ? translateTechnicalText(description) : null) ||
    (reason ? translateTechnicalText(reason) : null) ||
    (note ? translateTechnicalText(note) : null) ||
    (title ? translateTechnicalText(title) : null) ||
    'Registro de atividade do usuário.'
  );
'@
    $content = Replace-Regex-Required -Current $content -Pattern $patternFallback -Replacement $fallbackBlock -Label 'fallback de descrição'
}

Set-Content -Path $path -Value $content -Encoding UTF8

Write-Host "Labels amigáveis aplicados em $path" -ForegroundColor Green
