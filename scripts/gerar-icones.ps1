# Gera os ícones PNG do portal (192 e 512) a partir do mesmo desenho de web/public/icone.svg. Uso: powershell -File scripts/gerar-icones.ps1
Add-Type -AssemblyName System.Drawing
function Cor($hex, $a = 255) { $c = [System.Drawing.ColorTranslator]::FromHtml($hex); [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B) }
$k = 4.0
$bmp = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.Clear([System.Drawing.Color]::Transparent)
$r = 28 * $k; $d = 2 * $r
$fundo = New-Object System.Drawing.Drawing2D.GraphicsPath
$fundo.AddArc(0, 0, $d, $d, 180, 90); $fundo.AddArc(512 - $d, 0, $d, $d, 270, 90); $fundo.AddArc(512 - $d, 512 - $d, $d, $d, 0, 90); $fundo.AddArc(0, 512 - $d, $d, $d, 90, 90); $fundo.CloseFigure()
$deg = New-Object System.Drawing.Drawing2D.LinearGradientBrush ((New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 512, 512), (Cor '#7d3260'), (Cor '#4a1c38'))
$g.FillPath($deg, $fundo)
function Caneta($hex, $w, $a = 255) { $p = New-Object System.Drawing.Pen (Cor $hex $a), ($w * $k); $p.StartCap = 'Round'; $p.EndCap = 'Round'; $p.LineJoin = 'Round'; $p }
$arco = New-Object System.Drawing.Drawing2D.GraphicsPath
$arco.AddLine(34 * $k, 100 * $k, 34 * $k, 62 * $k); $arco.AddArc(34 * $k, 32 * $k, 60 * $k, 60 * $k, 180, 180); $arco.AddLine(94 * $k, 62 * $k, 94 * $k, 100 * $k)
$g.DrawPath((Caneta '#ffffff' 7), $arco)
$l = Caneta '#ffffff' 3.5 178
$g.DrawLine($l, 64 * $k, 52 * $k, 50 * $k, 82 * $k); $g.DrawLine($l, 64 * $k, 52 * $k, 78 * $k, 82 * $k); $g.DrawLine($l, 50 * $k, 82 * $k, 78 * $k, 82 * $k)
function Ponto($x, $y, $rr, $hex) { $g.FillEllipse((New-Object System.Drawing.SolidBrush (Cor $hex)), ($x - $rr) * $k, ($y - $rr) * $k, 2 * $rr * $k, 2 * $rr * $k) }
Ponto 64 52 7 '#ff8a80'; Ponto 50 82 6 '#ffffff'; Ponto 78 82 6 '#ffffff'
$g.DrawLine((Caneta '#e96e67' 5), 32 * $k, 106 * $k, 96 * $k, 106 * $k)
$pasta = Join-Path $PSScriptRoot '..\web\public\icones'
$bmp.Save((Join-Path $pasta 'icone-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$p = New-Object System.Drawing.Bitmap 192, 192
$g2 = [System.Drawing.Graphics]::FromImage($p); $g2.InterpolationMode = 'HighQualityBicubic'; $g2.SmoothingMode = 'AntiAlias'; $g2.DrawImage($bmp, 0, 0, 192, 192)
$p.Save((Join-Path $pasta 'icone-192.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output 'Icones gerados.'
