# Copy this file to publish.ps1 beside publish.cmd. Keep that copy PRIVATE.
# Put your Azure deployment token below; never commit or share the private copy.
[CmdletBinding()]
param([switch]$PrepareOnly, [switch]$NoPause)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$AzureDeploymentToken = 'REPLACE_WITH_YOUR_NEW_AZURE_DEPLOYMENT_TOKEN'
$originalToken = $env:SWA_CLI_DEPLOYMENT_TOKEN
$code = 1
try {
    if (-not $PrepareOnly -and $AzureDeploymentToken -ne 'REPLACE_WITH_YOUR_NEW_AZURE_DEPLOYMENT_TOKEN') {
        $env:SWA_CLI_DEPLOYMENT_TOKEN = $AzureDeploymentToken
    }
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'deployment\update-and-publish.ps1'), '-NoPause')
    if ($PrepareOnly) { $arguments += '-PrepareOnly' }
    & "$PSHOME\powershell.exe" @arguments
    $code = $LASTEXITCODE
} catch {
    Write-Host 'Publishing could not start. Check that the deployment folder exists and PowerShell is available.' -ForegroundColor Red
} finally {
    $env:SWA_CLI_DEPLOYMENT_TOKEN = $originalToken
    $AzureDeploymentToken = $null
    if (-not $NoPause) { [void](Read-Host 'Press Enter to close') }
}
exit $code
