param(
  [ValidateSet('Export','Import')]
  [string]$Mode = 'Export'
)

$ErrorActionPreference = 'Stop'

$abxSource = 'AbxLinks.json'

$abxWrapper = 'cms-data/abx-links.cms.json'

function Write-JsonFile {
  param(
    [Parameter(Mandatory = $true)] $Data,
    [Parameter(Mandatory = $true)] [string]$Path
  )

  $json = $Data | ConvertTo-Json -Depth 100
  Set-Content -Path $Path -Value $json -Encoding utf8
}

if ($Mode -eq 'Export') {
  New-Item -ItemType Directory -Path 'cms-data' -Force | Out-Null

  $abx = Get-Content -Path $abxSource -Raw | ConvertFrom-Json

  Write-JsonFile -Data ([ordered]@{ entries = @($abx) }) -Path $abxWrapper

  Write-Output 'Export complete: ABX wrapper file refreshed from source JSON.'
  exit 0
}

$abxCms = Get-Content -Path $abxWrapper -Raw | ConvertFrom-Json

if ($null -eq $abxCms.entries) {
  throw "Missing 'entries' in $abxWrapper"
}

Write-JsonFile -Data @($abxCms.entries) -Path $abxSource

Write-Output 'Import complete: ABX source JSON updated from CMS wrapper file.'
