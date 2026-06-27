# Fase 9.13.1K — Correção de encoding no Meu Histórico
#
# Corrige mojibake gerado por PowerShell/Windows em strings do MyHistory.tsx.
# Exemplo: AlteraÃ§Ã£o -> Altera\u00e7\u00e3o
#
# O arquivo final é gravado em UTF-8 sem BOM.

$ErrorActionPreference = 'Stop'

$path = 'src/pages/private/admin/settings/myHistory/MyHistory.tsx'

if (!(Test-Path $path)) {
    throw "Arquivo não encontrado: $path"
}

$content = Get-Content -Path $path -Raw

$replacements = [ordered]@{
    'AlteraÃ§Ã£o' = 'Altera\u00e7\u00e3o'
    'alteraÃ§Ã£o' = 'altera\u00e7\u00e3o'
    'SolicitaÃ§Ã£o' = 'Solicita\u00e7\u00e3o'
    'solicitaÃ§Ã£o' = 'solicita\u00e7\u00e3o'
    'ConfiguraÃ§Ã£o' = 'Configura\u00e7\u00e3o'
    'configuraÃ§Ã£o' = 'configura\u00e7\u00e3o'
    'CorreÃ§Ã£o' = 'Corre\u00e7\u00e3o'
    'correÃ§Ã£o' = 'corre\u00e7\u00e3o'
    'InformaÃ§Ã£o' = 'Informa\u00e7\u00e3o'
    'informaÃ§Ã£o' = 'informa\u00e7\u00e3o'
    'EndereÃ§o' = 'Endere\u00e7o'
    'endereÃ§o' = 'endere\u00e7o'
    'DescriÃ§Ã£o' = 'Descri\u00e7\u00e3o'
    'descriÃ§Ã£o' = 'descri\u00e7\u00e3o'
    'PermissÃ£o' = 'Permiss\u00e3o'
    'permissÃ£o' = 'permiss\u00e3o'
    'FunÃ§Ã£o' = 'Fun\u00e7\u00e3o'
    'funÃ§Ã£o' = 'fun\u00e7\u00e3o'
    'UsuÃ¡rio' = 'Usu\u00e1rio'
    'usuÃ¡rio' = 'usu\u00e1rio'
    'responsÃ¡vel' = 'respons\u00e1vel'
    'ResponsÃ¡vel' = 'Respons\u00e1vel'
    'HistÃ³rico' = 'Hist\u00f3rico'
    'histÃ³rico' = 'hist\u00f3rico'
    'MÃ©dio' = 'M\u00e9dio'
    'mÃ©dio' = 'm\u00e9dio'
    'NÃ£o' = 'N\u00e3o'
    'nÃ£o' = 'n\u00e3o'
}

$changed = $false
foreach ($item in $replacements.GetEnumerator()) {
    if ($content.Contains($item.Key)) {
        $content = $content.Replace($item.Key, $item.Value)
        $changed = $true
    }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)

if ($changed) {
    Write-Host "Encoding corrigido em $path" -ForegroundColor Green
} else {
    Write-Host "Nenhum mojibake conhecido encontrado em $path" -ForegroundColor Yellow
}
