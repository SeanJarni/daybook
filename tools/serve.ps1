# Tiny static file server for local testing (no installs needed).
# Usage: powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8080]
# Serves the repo root at http://localhost:<port>/ (localhost counts as secure, so service workers work).
param([int]$Port = 8080)
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'
  '.png'='image/png'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.ics'='text/calendar'
}
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $root at http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext(); $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $path.StartsWith($root) -or -not (Test-Path $path -PathType Leaf)) {
      $res.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes('Not found')
    } else {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers['Cache-Control'] = 'no-cache'
      $b = [IO.File]::ReadAllBytes($path)
    }
    $res.ContentLength64 = $b.Length; $res.OutputStream.Write($b, 0, $b.Length)
    Write-Host "$($res.StatusCode) /$rel"
  } catch { $res.StatusCode = 500 } finally { $res.Close() }
}
