[CmdletBinding()]
param([switch]$PrepareOnly, [switch]$NoPause)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$code = 1
$originalToken = $env:SWA_CLI_DEPLOYMENT_TOKEN
Remove-Item Env:SWA_CLI_DEPLOYMENT_TOKEN -ErrorAction SilentlyContinue
function Git-Output([string[]]$Arguments) {
    $result = & git @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Git command failed. No deployment attempted.' }
    return $result
}
try {
    $root = Split-Path $PSScriptRoot -Parent
    Set-Location -LiteralPath $root
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows, then reopen this window.' }
    $gitRoot = Git-Output @('rev-parse', '--show-toplevel')
    if ([IO.Path]::GetFullPath($gitRoot) -ne [IO.Path]::GetFullPath($root)) { throw 'Run this from the root of your retirementplanner Git clone.' }
    $origin = Git-Output @('remote', 'get-url', 'origin')
    if ($origin -notmatch '^(https://github\.com/gbgr1979/retirementplanner(?:\.git)?|git@github\.com:gbgr1979/retirementplanner(?:\.git)?|ssh://git@github\.com/gbgr1979/retirementplanner(?:\.git)?)$') { throw 'Origin must be gbgr1979/retirementplanner on GitHub.' }
    if ((Git-Output @('branch', '--show-current')) -ne 'main') { throw 'Switch to main before publishing; this script will not switch branches for you.' }
    if (Git-Output @('ls-files', '--', 'publish.ps1', 'publish.local.ps1')) { throw 'A private publish PS1 is tracked! Remove it from Git and rotate the token before continuing.' }
    if (Git-Output @('status', '--porcelain', '--untracked-files=all')) { throw 'Working tree has changes. Commit, move or stash them yourself before publishing. Nothing was overwritten.' }
    Write-Host 'Fetching the latest main...'
    Git-Output @('fetch', '--no-tags', 'origin', 'main')
    & git merge-base --is-ancestor HEAD FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Local main has unpublished or divergent commits. Resolve manually; no reset or force-pull was performed.' }
    if (Git-Output @('ls-tree', '--name-only', 'FETCH_HEAD', '--', 'publish.ps1', 'publish.local.ps1')) { throw 'Remote main tracks local credentials. Refusing to overwrite your local token file.' }
    Git-Output @('merge', '--ff-only', '--no-overwrite-ignore', 'FETCH_HEAD')
    if (Git-Output @('ls-files', '--', 'publish.ps1', 'publish.local.ps1')) { throw 'Refusing tracked local credentials. Rotate the token and remove the file from Git.' }
    # Fresh process loads the UPDATED publisher, not the pre-pull copy of its functions.
    $env:SWA_CLI_DEPLOYMENT_TOKEN = $originalToken
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'deployment\publish-static-web-app.ps1'), '-NoPause')
    if ($PrepareOnly) { $arguments += '-PrepareOnly' }
    & "$PSHOME\powershell.exe" @arguments
    $code = $LASTEXITCODE
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    $env:SWA_CLI_DEPLOYMENT_TOKEN = $originalToken
    if (-not $NoPause) { [void](Read-Host 'Press Enter to close') }
}
exit $code
