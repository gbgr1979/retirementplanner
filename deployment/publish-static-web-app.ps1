#Requires -Version 5.1
<#
.SYNOPSIS
Publishes this website to Azure Static Web Apps without Node.js or Azure modules.
.DESCRIPTION
Downloads Microsoft's stable Windows deployment client and checks its SHA-256
against Microsoft's release metadata. Packages only reviewed public site files.
Prompts for the app's deployment token without echoing it, then publishes to
production. The token is passed only in the child process environment.
.EXAMPLE
.\deployment\publish-static-web-app.ps1
.EXAMPLE
.\deployment\publish-static-web-app.ps1 -PrepareOnly
.LINK
https://github.com/Azure/static-web-apps-cli/blob/main/src/cli/commands/deploy/deploy.ts
.LINK
https://github.com/Azure/static-web-apps-cli/blob/main/src/core/constants.ts
#>
[CmdletBinding()]
param(
    [string]$SiteRoot,
    [Security.SecureString]$DeploymentToken,
    [switch]$PrepareOnly,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$code = 1
$environmentToken = $env:SWA_CLI_DEPLOYMENT_TOKEN
Remove-Item Env:SWA_CLI_DEPLOYMENT_TOKEN -ErrorAction SilentlyContinue
$clientDirectory = $null
if ([string]::IsNullOrWhiteSpace($SiteRoot)) {
    $SiteRoot = Split-Path -Parent $PSScriptRoot
}
if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem) {
    throw 'This script uses Microsoft''s Windows x64 deployment client.'
}

function Get-DeploymentClientHash {
    param([string]$Path)
    $fileStream = [IO.File]::OpenRead($Path)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        return [BitConverter]::ToString($sha256.ComputeHash($fileStream)).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha256.Dispose()
        $fileStream.Dispose()
    }
}

function Get-MicrosoftDeploymentClient {
    # This is the release metadata URL used by Microsoft's SWA CLI itself.
    $metadata = Invoke-RestMethod -Uri 'https://aka.ms/swalocaldeploy' -TimeoutSec 30
    $stable = @($metadata | Where-Object { $_.version -eq 'stable' })
    if ($stable.Count -ne 1) { throw 'Microsoft release metadata did not contain one stable release.' }
    $release = $stable[0]
    $windows = $release.files.'win-x64'
    if ($release.buildId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' -or
        $windows.sha -notmatch '^[A-Fa-f0-9]{64}$') {
        throw 'Microsoft release metadata contained an invalid build identifier or SHA-256.'
    }
    $downloadUri = [Uri]$windows.url
    if (-not $downloadUri.IsAbsoluteUri -or $downloadUri.Scheme -ne 'https') {
        throw 'The Microsoft deployment client must be downloaded over HTTPS.'
    }

    $directory = Join-Path $clientDirectory $release.buildId
    $clientPath = Join-Path $directory 'StaticSitesClient.exe'
    $null = New-Item -ItemType Directory -Path $directory -Force
    $expectedHash = $windows.sha.ToLowerInvariant()
    $cachedHash = if (Test-Path -LiteralPath $clientPath -PathType Leaf) {
        Get-DeploymentClientHash -Path $clientPath
    } else { '' }

    if ($cachedHash -ne $expectedHash) {
        Write-Host 'Downloading Microsoft''s standalone deployment client (no installation required)...'
        $temporaryDownload = Join-Path $directory ('client-' + [Guid]::NewGuid().ToString('N') + '.download')
        try {
            Invoke-WebRequest -Uri $downloadUri.AbsoluteUri -OutFile $temporaryDownload -UseBasicParsing -TimeoutSec 180
            $downloadedHash = Get-DeploymentClientHash -Path $temporaryDownload
            if ($downloadedHash -ne $expectedHash) {
                throw 'The deployment client did not match Microsoft''s published SHA-256; it will not be executed.'
            }
            Copy-Item -LiteralPath $temporaryDownload -Destination $clientPath -Force
        } finally {
            if (Test-Path -LiteralPath $temporaryDownload) {
                Remove-Item -LiteralPath $temporaryDownload -Force
            }
        }
    }

    Write-Host ('Verified Microsoft deployment client: ' + $release.buildId)
    return [pscustomobject]@{ Path = $clientPath; BuildId = $release.buildId }
}

$originalSecurityProtocol = [Net.ServicePointManager]::SecurityProtocol
$process = $null
$clientStarted = $false
$plainToken = $null
$clientEnvironment = $null
try {
    # Windows PowerShell 5.1 may otherwise negotiate an older TLS version.
    [Net.ServicePointManager]::SecurityProtocol = $originalSecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'
    $resolvedSiteRoot = (Resolve-Path -LiteralPath $SiteRoot).Path
    $siteFolder = & (Join-Path $PSScriptRoot 'prepare-static-web-app.ps1') -SiteRoot $SiteRoot
    if ($PrepareOnly) {
        Write-Host 'Preparation complete. No client downloaded, no token used, nothing uploaded.'
        $code = 0
        return
    }
    $clientDirectory = Join-Path ([IO.Path]::GetTempPath()) ('retirement-publish-' + [Guid]::NewGuid().ToString('N'))
    $null = New-Item -ItemType Directory -Path $clientDirectory
    $client = Get-MicrosoftDeploymentClient
    if (-not $DeploymentToken -and -not [string]::IsNullOrWhiteSpace($environmentToken)) {
        $DeploymentToken = ConvertTo-SecureString $environmentToken -AsPlainText -Force
    }

    if (-not $DeploymentToken) {
        Write-Host 'In Azure, open your Static Web App > Overview > Manage deployment token.'
        $DeploymentToken = Read-Host 'Paste that app''s deployment token (hidden)' -AsSecureString
    }
    $plainToken = ([Net.NetworkCredential]::new('', $DeploymentToken)).Password.Trim()
    if ([string]::IsNullOrWhiteSpace($plainToken)) { throw 'A deployment token is required.' }

    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $client.Path
    # The native client creates deployment artifacts relative to its working
    # directory; that directory must be outside the public artifact folder.
    $startInfo.WorkingDirectory = $clientDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    # Match Microsoft's SWA CLI environment contract. No token appears in the
    # command line or on disk, and the parent shell environment is unchanged.
    $clientEnvironment = @{
        'DEPLOYMENT_ACTION' = 'upload'
        'DEPLOYMENT_PROVIDER' = 'SwaCli'
        'REPOSITORY_BASE' = $clientDirectory
        'APP_LOCATION' = $siteFolder
        'API_LOCATION' = ''
        'DATA_API_LOCATION' = ''
        'CONFIG_FILE_LOCATION' = $siteFolder
        'SKIP_APP_BUILD' = 'true'
        'SKIP_API_BUILD' = 'true'
        'VERBOSE' = 'false'
        'DEPLOYMENT_TOKEN' = $plainToken
    }
    # Production deployments omit DEPLOYMENT_ENVIRONMENT. Clear any inherited
    # staging/branch settings so a previous terminal session cannot change this.
    foreach ($name in @('DEPLOYMENT_TOKEN', 'SWA_CLI_DEPLOYMENT_TOKEN', 'SWA_CLI_DEBUG', 'DEBUG', 'NODE_DEBUG', 'AZURE_LOG_LEVEL', 'DEPLOYMENT_ENVIRONMENT', 'BRANCH', 'HEAD_BRANCH', 'BASE_BRANCH',
        'PRODUCTION_BRANCH', 'PULL_REQUEST_TITLE', 'OUTPUT_LOCATION', 'GITHUB_EVENT_PATH',
        'GITHUB_EVENT_NAME', 'GITHUB_REF', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF')) {
        $startInfo.EnvironmentVariables.Remove($name)
    }
    foreach ($name in $clientEnvironment.Keys) {
        $startInfo.EnvironmentVariables[$name] = $clientEnvironment[$name]
    }

    Write-Host 'Publishing the prepared website to production. This may take a few minutes...'
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw 'Could not start the Microsoft deployment client.' }
    $clientStarted = $true
    # Read both streams asynchronously and show progress without putting the
    # token in the terminal. No event handlers or extra PowerShell modules.
    $streams = @(
        @{ Reader = $process.StandardOutput; Task = $process.StandardOutput.ReadLineAsync() },
        @{ Reader = $process.StandardError; Task = $process.StandardError.ReadLineAsync() }
    )
    $capturedOutput = New-Object Text.StringBuilder
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while (@($streams | Where-Object { $null -ne $_.Task }).Count -gt 0 -or -not $process.HasExited) {
        foreach ($stream in $streams) {
            if ($null -ne $stream.Task -and $stream.Task.IsCompleted) {
                $line = $stream.Task.GetAwaiter().GetResult()
                if ($null -eq $line) {
                    $stream.Task = $null
                } else {
                    $line = $line.Replace($plainToken, '[redacted]') -replace '\x1B\[[0-?]*[ -/]*[@-~]', ''
                    Write-Host $line
                    $null = $capturedOutput.AppendLine($line)
                    $stream.Task = $stream.Reader.ReadLineAsync()
                }
            }
        }
        if ($watch.Elapsed.TotalMinutes -gt 20) {
            throw 'The deployment client exceeded 20 minutes. Check the Azure app for deployment status before retrying.'
        }
        Start-Sleep -Milliseconds 50
    }
    $process.WaitForExit()
    $output = $capturedOutput.ToString()
    if ($process.ExitCode -ne 0) {
        throw ('The Microsoft deployment client failed with exit code ' + $process.ExitCode + '. See its output above.')
    }
    $siteUrl = [regex]::Match($output, 'Visit your site at:\s*(https://[^\s]+)')
    if (-not $siteUrl.Success) {
        throw 'The client exited without a confirmed deployment URL. Check the output and Azure before assuming the upload succeeded.'
    }
    Write-Host ('Published successfully: ' + $siteUrl.Groups[1].Value)
    $code = 0
} catch {
    $message = $_.Exception.Message
    if ($plainToken) { $message = $message.Replace($plainToken, '[redacted]') }
    if ($environmentToken) { $message = $message.Replace($environmentToken, '[redacted]') }
    Write-Host $message -ForegroundColor Red
} finally {
    if ($process) {
        if ($clientStarted -and -not $process.HasExited) { $process.Kill() }
        $process.StartInfo.EnvironmentVariables.Remove('DEPLOYMENT_TOKEN')
        $process.Dispose()
    }
    if ($null -ne $clientEnvironment) {
        $clientEnvironment['DEPLOYMENT_TOKEN'] = $null
    }
    $plainToken = $null
    [Net.ServicePointManager]::SecurityProtocol = $originalSecurityProtocol
    $env:SWA_CLI_DEPLOYMENT_TOKEN = $environmentToken
    $environmentToken = $null
    if ($clientDirectory -and (Test-Path -LiteralPath $clientDirectory)) { Remove-Item -LiteralPath $clientDirectory -Recurse -Force -ErrorAction SilentlyContinue }
    if (-not $NoPause) { [void](Read-Host 'Press Enter to close') }
    exit $code
}
