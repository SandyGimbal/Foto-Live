Add-Type -AssemblyName System.Drawing

function Create-AppIcon {
    param(
        [int]$size,
        [string]$outputPath,
        [bool]$maskable = $false
    )

    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 12, 15))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # If not maskable, we can draw a subtle rounded square or dark vignette
    $scale = if ($maskable) { 0.65 } else { 0.85 }
    $center = $size / 2
    $contentSize = $size * $scale
    $half = $contentSize / 2

    # Outer glow / ring (amber)
    $amberPenOuter = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 180, 0), ($size * 0.04))
    $g.DrawEllipse($amberPenOuter, [float]($center - $half), [float]($center - $half), [float]$contentSize, [float]$contentSize)

    # Camera body rounded rectangle
    $camW = $contentSize * 0.75
    $camH = $contentSize * 0.58
    $camX = $center - ($camW / 2)
    $camY = $center - ($camH / 2) + ($size * 0.02)
    
    $camPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rad = $size * 0.06
    $camPath.AddArc([float]$camX, [float]$camY, [float]$rad, [float]$rad, 180, 90)
    $camPath.AddArc([float]($camX + $camW - $rad), [float]$camY, [float]$rad, [float]$rad, 270, 90)
    $camPath.AddArc([float]($camX + $camW - $rad), [float]($camY + $camH - $rad), [float]$rad, [float]$rad, 0, 90)
    $camPath.AddArc([float]$camX, [float]($camY + $camH - $rad), [float]$rad, [float]$rad, 90, 90)
    $camPath.CloseFigure()

    $camBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 26, 28, 35))
    $g.FillPath($camBrush, $camPath)
    $camPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 60, 64, 75), ($size * 0.015))
    $g.DrawPath($camPen, $camPath)

    # Camera bump / top notch
    $bumpW = $camW * 0.35
    $bumpH = $size * 0.04
    $bumpX = $center - ($bumpW / 2)
    $bumpY = $camY - $bumpH + 1
    $bumpBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 35, 38, 48))
    $g.FillRectangle($bumpBrush, [float]$bumpX, [float]$bumpY, [float]$bumpW, [float]$bumpH)

    # Lens outer ring
    $lensR = $camH * 0.65
    $lensX = $center - ($lensR / 2)
    $lensY = $center - ($lensR / 2) + ($size * 0.02)
    $lensOuterBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 19, 24))
    $g.FillEllipse($lensOuterBrush, [float]$lensX, [float]$lensY, [float]$lensR, [float]$lensR)

    # Concentric amber ring (Live indicator)
    $amberPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 190, 0), ($size * 0.025))
    $g.DrawEllipse($amberPen, [float]$lensX, [float]$lensY, [float]$lensR, [float]$lensR)

    # Lens center glass
    $glassR = $lensR * 0.6
    $glassX = $center - ($glassR / 2)
    $glassY = $center - ($glassR / 2) + ($size * 0.02)
    $glassBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF([float]$glassX, [float]$glassY)),
        (New-Object System.Drawing.PointF([float]($glassX + $glassR), [float]($glassY + $glassR))),
        [System.Drawing.Color]::FromArgb(255, 30, 45, 70),
        [System.Drawing.Color]::FromArgb(255, 10, 15, 25)
    )
    $g.FillEllipse($glassBrush, [float]$glassX, [float]$glassY, [float]$glassR, [float]$glassR)

    # Shutter aperture dot (center gold)
    $dotR = $glassR * 0.35
    $dotX = $center - ($dotR / 2)
    $dotY = $center - ($dotR / 2) + ($size * 0.02)
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 204, 0))
    $g.FillEllipse($dotBrush, [float]$dotX, [float]$dotY, [float]$dotR, [float]$dotR)

    # Reflection highlight
    $reflPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), ($size * 0.015))
    $reflR = $glassR * 0.8
    $g.DrawArc($reflPen, [float]($center - ($reflR / 2)), [float]($center - ($reflR / 2) + ($size * 0.02)), [float]$reflR, [float]$reflR, 200, 70)

    # Live Badge indicator dot top right
    $liveDotR = $size * 0.05
    $liveDotX = $camX + $camW - ($size * 0.08)
    $liveDotY = $camY + ($size * 0.05)
    $liveDotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 75, 75))
    $g.FillEllipse($liveDotBrush, [float]$liveDotX, [float]$liveDotY, [float]$liveDotR, [float]$liveDotR)

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bitmap.Dispose()
    Write-Output "Created: $outputPath"
}

Create-AppIcon -size 192 -outputPath "icons/icon-192.png" -maskable $false
Create-AppIcon -size 512 -outputPath "icons/icon-512.png" -maskable $false
Create-AppIcon -size 192 -outputPath "icons/icon-maskable-192.png" -maskable $true
Create-AppIcon -size 512 -outputPath "icons/icon-maskable-512.png" -maskable $true
Create-AppIcon -size 180 -outputPath "icons/apple-touch-icon.png" -maskable $false
Create-AppIcon -size 32  -outputPath "icons/icon-32.png" -maskable $false
