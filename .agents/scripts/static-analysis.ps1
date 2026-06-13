param(
  [switch]$Fast
)

$ErrorActionPreference = "Continue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

if (-not (Test-Path "package.json")) {
  Write-Host "No package.json found. Skipping static analysis."
  exit 0
}

if (-not (Test-Path "node_modules")) {
  Write-Host "node_modules is missing. Run npm install before TypeScript/lint checks."
  exit 0
}

$failed = $false

Write-Step "TypeScript"
npx tsc --noEmit --pretty false
if ($LASTEXITCODE -ne 0) {
  $failed = $true
}

if (-not $Fast) {
  Write-Step "Next lint"
  npm run lint
  if ($LASTEXITCODE -ne 0) {
    $failed = $true
  }
}

if ($failed) {
  Write-Host ""
  Write-Host "Static analysis failed."
  exit 1
}

Write-Host ""
Write-Host "Static analysis passed."
exit 0

