#Requires -Version 5.1
[CmdletBinding()]
param([string]$SiteRoot)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($SiteRoot)) { $SiteRoot = Split-Path -Parent $PSScriptRoot }
$root = (Resolve-Path -LiteralPath $SiteRoot).Path
# Exact public payload. Never recursively copy src or personal plan files.
$files = @('index.html', 'styles.css', 'staticwebapp.config.json',
    'src/app.js', 'src/model.js', 'src/plan.js', 'src/view.js')
foreach ($relative in @('src') + $files) {
    $item = Get-Item -LiteralPath (Join-Path $root $relative) -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Linked build input is forbidden: $relative" }
    if ($relative -ne 'src' -and $item.PSIsContainer) { throw "Expected a public file: $relative" }
}
# Validate the hosting configuration before preparing any upload.
$null = Get-Content -LiteralPath (Join-Path $root 'staticwebapp.config.json') -Raw | ConvertFrom-Json
$destination = Join-Path $root 'dist'
if (Test-Path -LiteralPath $destination) {
    $existing = Get-Item -LiteralPath $destination -Force
    if (($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Refusing linked dist directory.' }
    # Refuse linked descendants before deleting generated output.
    foreach ($item in Get-ChildItem -LiteralPath $destination -Recurse -Force) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Refusing linked content in dist.' }
    }
    Remove-Item -LiteralPath $destination -Recurse -Force
}
$null = New-Item -ItemType Directory -Path $destination
foreach ($relative in $files) {
    $source = Join-Path $root $relative
    $target = Join-Path $destination $relative
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force
    Copy-Item -LiteralPath $source -Destination $target
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash) { throw 'Public asset copy verification failed.' }
}
$actual = @(Get-ChildItem -LiteralPath $destination -Recurse -File -Force | ForEach-Object { $_.FullName.Substring($destination.Length + 1).Replace('\', '/') })
if (@(Compare-Object ($files | Sort-Object) ($actual | Sort-Object)).Count -ne 0) { throw 'Unexpected files in deployment payload.' }
Write-Host 'Prepared and verified seven public assets. No Node.js or npm required.'
Write-Output $destination
