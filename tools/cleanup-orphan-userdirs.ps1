param(
  [Parameter(Mandatory = $false)]
  [string]$TargetPath,

  [Parameter(Mandatory = $false)]
  [switch]$Auto,

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Get-ProfileListPaths {
  Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList" -ErrorAction SilentlyContinue |
    ForEach-Object {
      $p = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
      if ($p.ProfileImagePath) {
        [pscustomobject]@{ Sid = $_.PSChildName; Path = $p.ProfileImagePath }
      }
    } | Where-Object { $_ }
}

function Get-Win32UserProfilePaths {
  Get-CimInstance Win32_UserProfile -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPath } |
    ForEach-Object { $_.LocalPath } |
    Select-Object -Unique
}

function Get-RealCurrentProfilePath {
  $sid = (whoami /user | Select-String "S-1-5-21-" | ForEach-Object { ($_.ToString() -split "\s+")[-1] })
  if (-not $sid) { return $null }
  try {
    (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid" -ErrorAction Stop).ProfileImagePath
  } catch {
    $null
  }
}

function Remove-UserDir([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Missing: $path"
    return
  }

  $full = (Get-Item -LiteralPath $path -Force).FullName
  if ($full -notlike "C:\Users\*") { throw "Refusing to delete non-user path: $full" }

  $currentReal = Get-RealCurrentProfilePath
  if ($currentReal -and ($full -eq $currentReal)) { throw "Refusing to delete your real profile: $full" }

  $specialNames = @("Public", "Default", "Default User", "All Users")
  $leaf = Split-Path -Leaf $full
  if ($specialNames -contains $leaf) { throw "Refusing to delete special profile directory: $full" }

  $sid = (whoami /user | Select-String "S-1-5-21-" | ForEach-Object { ($_.ToString() -split "\s+")[-1] })
  if (-not $sid) { throw "Failed to detect current user SID via whoami /user." }

  Write-Host "Deleting: $full"
  Write-Host "Takeown..."
  cmd /c "takeown /F ""$full"" /R /D Y" | Out-Host
  Write-Host "Icacls grant..."
  cmd /c "icacls ""$full"" /grant *${sid}:(OI)(CI)F /T /C" | Out-Host
  Write-Host "Rmdir..."
  cmd /c "rmdir /S /Q ""$full""" | Out-Host

  if (Test-Path -LiteralPath $full) { throw "Delete failed, still exists: $full" }
  Write-Host "Deleted: $full"
}

if (-not $Auto -and -not $TargetPath) {
  throw "Usage: pass -TargetPath <path> or use -Auto. Add -Force to actually delete."
}

$profileList = Get-ProfileListPaths
$profileListPaths = $profileList | Select-Object -ExpandProperty Path -Unique
$win32Paths = Get-Win32UserProfilePaths

$candidates = @()

if ($Auto) {
  $userRoot = "C:\Users"
  $dirs = Get-ChildItem -LiteralPath $userRoot -Directory -Force -ErrorAction Stop
  foreach ($d in $dirs) {
    $p = $d.FullName
    $leaf = $d.Name

    if (@("Public", "Default", "Default User", "All Users") -contains $leaf) { continue }
    if ($profileListPaths -contains $p) { continue }
    if ($win32Paths -contains $p) { continue }

    $candidates += $p
  }
} else {
  $candidates = @($TargetPath)
}

$candidates = $candidates | Where-Object { $_ } | Select-Object -Unique

if (-not $candidates -or $candidates.Count -eq 0) {
  Write-Host "No orphan user directories found."
  exit 0
}

Write-Host "Candidates:"
$candidates | ForEach-Object { Write-Host "  $_" }

if (-not $Force) {
  Write-Host ""
  Write-Host "Dry-run only. Re-run with -Force to delete."
  exit 0
}

foreach ($c in $candidates) {
  Remove-UserDir -path $c
}
