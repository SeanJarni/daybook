# Draws the Daybook app icons from the header logo (.logo in css/app.css):
# a conic gradient of the Sunset colors, from 200deg, with a white dot in the middle.
# Usage: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

$stops = @('#F6A961','#E56B5E','#BB405C','#843660','#583168','#F6A961') | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_) }
function Mix($a, $b, $t) { [System.Drawing.Color]::FromArgb(255, [int]($a.R + ($b.R - $a.R) * $t), [int]($a.G + ($b.G - $a.G) * $t), [int]($a.B + ($b.B - $a.B) * $t)) }
function ColorAt($t) { $seg = [Math]::Min([int][Math]::Floor($t * 5), 4); Mix $stops[$seg] $stops[$seg + 1] ($t * 5 - $seg) }

# $radius: corner radius as a fraction of size (0 = full square, for iOS and maskable)
# $dot: white dot diameter as a fraction of size
function Draw($size, $radius, $dot, $name) {
  $ss = 4; $S = $size * $ss
  $big = New-Object System.Drawing.Bitmap $S, $S
  $g = [System.Drawing.Graphics]::FromImage($big)
  $g.SmoothingMode = 'AntiAlias'; $g.Clear([System.Drawing.Color]::Transparent)
  if ($radius -gt 0) {
    $r = $S * $radius * 2; $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, $r, $r, 180, 90); $p.AddArc($S - $r, 0, $r, $r, 270, 90)
    $p.AddArc($S - $r, $S - $r, $r, $r, 0, 90); $p.AddArc(0, $S - $r, $r, $r, 90, 90); $p.CloseFigure()
    $g.SetClip($p)
  }
  # conic gradient: CSS angles start at 12 o'clock; GDI+ angles start at 3 o'clock
  $steps = 1440; $R = $S * 1.5
  for ($i = 0; $i -lt $steps; $i++) {
    $b = New-Object System.Drawing.SolidBrush (ColorAt ($i / $steps))
    $g.FillPie($b, ($S / 2 - $R), ($S / 2 - $R), 2 * $R, 2 * $R, (200 + $i * 360 / $steps - 90), (360 / $steps + 0.4))
    $b.Dispose()
  }
  $g.ResetClip()
  $d = $S * $dot
  $g.FillEllipse([System.Drawing.Brushes]::White, ($S - $d) / 2, ($S - $d) / 2, $d, $d)
  $g.Dispose()
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g2 = [System.Drawing.Graphics]::FromImage($bmp)
  $g2.InterpolationMode = 'HighQualityBicubic'; $g2.PixelOffsetMode = 'HighQuality'
  $g2.DrawImage($big, 0, 0, $size, $size)
  $g2.Dispose(); $big.Dispose()
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  Write-Host "icons/$name"
}

# Proportions from the CSS logo: 28px box, 9px corners, 12px dot (inset 8px)
Draw 180 0 (12 / 28) 'apple-touch-icon.png'          # iOS rounds the corners itself
Draw 192 (9 / 28) (12 / 28) 'icon-192.png'
Draw 512 (9 / 28) (12 / 28) 'icon-512.png'
Draw 512 0 (12 / 28 * 0.85) 'icon-maskable-512.png'  # full bleed, dot kept in the safe zone
Draw 32 (9 / 28) (12 / 28) 'favicon-32.png'
