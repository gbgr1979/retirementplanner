[CmdletBinding()]
param([switch]$PrepareOnly, [switch]$NoPause)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$code = 1
$originalLocation = Get-Location
$savedEnvironment = @{}
Get-ChildItem Env: | Where-Object { $_.Name -like 'SWA_*' -or $_.Name -in @('DEBUG', 'NODE_DEBUG', 'AZURE_LOG_LEVEL') } | ForEach-Object { $savedEnvironment[$_.Name] = $_.Value; Remove-Item "Env:$($_.Name)" }
$temp = $null
$AzureDeploymentToken = $null
try {
    $root = Split-Path $PSScriptRoot -Parent
    Set-Location -LiteralPath $root
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or later (including npm), then reopen this window.' }
    $version = & node -p 'process.versions.node'
    if ($LASTEXITCODE -ne 0 -or [int]($version.Split('.')[0]) -lt 22) { throw 'Node.js 22 or later is required.' }
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw 'Tests/build failed. Nothing was deployed.' }
    & node scripts/verify-dist.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Unsafe deployment payload. Nothing was deployed.' }
    $dist = Join-Path $root 'dist'
    if ($PrepareOnly) {
        Write-Host "Ready in $dist. PrepareOnly: no credentials read, no Azure connection or deployment."
    } else {
        # Install the official pinned CLI before exposing any deployment token.
        # Lifecycle scripts are disabled; keychain support is not used.
        $temp = Join-Path ([IO.Path]::GetTempPath()) ('retirement-publish-' + [guid]::NewGuid().ToString('N'))
        [void](New-Item -ItemType Directory -Path $temp)
        Set-Location -LiteralPath $temp
        & npm.cmd install --prefix $temp --no-save --package-lock=false --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org '@azure/static-web-apps-cli@2.0.10'
        if ($LASTEXITCODE -ne 0) { throw 'Could not install the pinned Microsoft SWA CLI. Nothing was deployed.' }
        $credentialFile = Join-Path $root 'publish.local.ps1'
        if (Test-Path -LiteralPath $credentialFile) {
            $trackedCredential = & git -C $root ls-files -- publish.local.ps1
            if ($LASTEXITCODE -ne 0) { throw 'Could not verify local credentials are untracked. Use a Git clone.' }
            if ($trackedCredential) { throw 'Refusing tracked local credentials. Remove the file from Git and rotate the token.' }
            # This is explicitly opted-in local PowerShell code, never fetched from Git.
            try { . $credentialFile } catch { throw 'Could not read publish.local.ps1. Check its syntax locally; do not share its contents.' }
        } elseif ($savedEnvironment.ContainsKey('SWA_CLI_DEPLOYMENT_TOKEN')) {
            $AzureDeploymentToken = $savedEnvironment['SWA_CLI_DEPLOYMENT_TOKEN']
        } else {
            $secureToken = Read-Host 'Paste Azure Static Web App deployment token (hidden)' -AsSecureString
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
            try { $AzureDeploymentToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
            finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secureToken.Dispose() }
        }
        if ([string]::IsNullOrWhiteSpace($AzureDeploymentToken) -or $AzureDeploymentToken -eq 'REPLACE_WITH_YOUR_NEW_AZURE_DEPLOYMENT_TOKEN') { throw 'Provide a valid token in publish.local.ps1, the environment, or the hidden prompt.' }
        $env:SWA_CLI_DEPLOYMENT_TOKEN = $AzureDeploymentToken
        $env:SWA_CLI_DEBUG = 'log'
        $env:SWA_CLI_TELEMETRY = 'off'
        $cli = Join-Path $temp 'node_modules\@azure\static-web-apps-cli\dist\cli\bin.js'
        Write-Host 'Publishing the seven public dist assets to Azure production...'
        & node $cli deploy --app-location $dist --output-location . --swa-config-location $dist --env production --no-use-keychain
        if ($LASTEXITCODE -ne 0) { throw 'Azure deployment failed. Review the CLI output and retry after resolving the error.' }
        Write-Host 'Azure CLI reported successful production deployment.'
    }
    $code = 0
} catch {
    # Never interpolate credential values into errors or commands.
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    $AzureDeploymentToken = $null
    Get-ChildItem Env: | Where-Object { $_.Name -like 'SWA_*' -or $_.Name -in @('DEBUG', 'NODE_DEBUG', 'AZURE_LOG_LEVEL') } | ForEach-Object { Remove-Item "Env:$($_.Name)" }
    foreach ($name in $savedEnvironment.Keys) { Set-Item "Env:$name" $savedEnvironment[$name] }
    Set-Location -LiteralPath $originalLocation.Path
    if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
    if (-not $NoPause) { [void](Read-Host 'Press Enter to close') }
}
exit $code
