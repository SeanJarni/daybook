# Writes the list of app files and a content hash into sw.js (between the BUILD markers).
# Run after changing any app file, before committing:
#   powershell -ExecutionPolicy Bypass -File tools\build-sw.ps1
# The hash changes only when a cached file changes, which is what makes phones update.
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$files = @('index.html', 'manifest.webmanifest')
foreach ($dir in 'css', 'js', 'icons', 'slides', 'docs') {
  $files += Get-ChildItem (Join-Path $root $dir) -File | Sort-Object Name | ForEach-Object { "$dir/$($_.Name)" }
}
$sha = [Security.Cryptography.SHA256]::Create()
$all = New-Object System.Text.StringBuilder
foreach ($f in $files) {
  $bytes = [IO.File]::ReadAllBytes((Join-Path $root $f))
  [void]$all.Append($f).Append(([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', ''))
}
$version = (([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($all.ToString()))) -replace '-', '').Substring(0, 12)).ToLower()
$list = (@('./') + $files | ForEach-Object { "'$_'" }) -join ",`n  "
$block = "// BUILD:START`nconst VERSION='$version';`nconst ASSETS=[`n  $list`n];`n// BUILD:END"
$swPath = Join-Path $root 'sw.js'
$sw = [IO.File]::ReadAllText($swPath)
$sw = [Regex]::Replace($sw, '(?s)// BUILD:START.*?// BUILD:END', { param($m) $block })
[IO.File]::WriteAllText($swPath, $sw, (New-Object System.Text.UTF8Encoding $false))
Write-Host "sw.js: version $version, $($files.Count + 1) files"
