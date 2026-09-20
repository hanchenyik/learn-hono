$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path 'backend/node_modules')) {
  throw 'Install backend dependencies first: cd backend; npm install'
}
if (-not (Test-Path '.env')) {
  throw 'Create a repository-root .env before starting the app.'
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($null -eq $npm) {
  throw 'npm.cmd was not found on PATH.'
}
Write-Host "Using npm: $($npm.Source)"

Write-Host 'Starting PetitBakery on http://localhost:8788 (API on http://localhost:8787)'
& node.exe scripts/start.mjs
exit $LASTEXITCODE
