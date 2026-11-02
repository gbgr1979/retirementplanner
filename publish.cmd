@echo off
setlocal EnableExtensions DisableDelayedExpansion
(
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deployment\update-and-publish.ps1" %*
  call exit /b %%ERRORLEVEL%%
)
