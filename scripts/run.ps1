<#
Usage:
  .\scripts\run.ps1 -VoicePath public\voice.mp3
  .\scripts\run.ps1 -VoicePath public\voice.mp3 -OutName my-video.mp4
  .\scripts\run.ps1 -VoicePath public\voice.mp3 -OutName my-video.mp4 -ScriptPath public\script.txt -Language fa
  .\scripts\run.ps1 -VoicePath public\voice.mp3 -RequiredAssets "logo.png,demo.gif"

If PowerShell blocks running local scripts, either run once:
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
or invoke it directly:
  powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1 -VoicePath public\voice.mp3 -Language fa
#>
param(
    [Parameter(Mandatory = $true)][string]$VoicePath,
    [string]$OutName = "final.mp4",
    [string]$ScriptPath = "",
    [string]$Language = "",
    # Comma-separated filenames already in public/assets/ that MUST appear
    # somewhere in the video, instead of only being used if the AI director
    # happens to pick them on its own — e.g. -RequiredAssets "logo.png,demo.gif"
    [string]$RequiredAssets = ""
)

$ErrorActionPreference = "Stop"

function Assert-Success($step) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ '$step' failed with exit code $LASTEXITCODE. Stopping."
        exit 1
    }
}

$FileName = Split-Path $VoicePath -Leaf
$Dest = Join-Path "public" $FileName

Write-Host "== 1/4 Placing audio in public/ =="
$srcFull = (Resolve-Path $VoicePath).Path
$destFull = if (Test-Path $Dest) { (Resolve-Path $Dest).Path } else { $null }
if ($srcFull -ne $destFull) {
    Copy-Item $VoicePath $Dest -Force
} else {
    Write-Host "  (already in public/, skipping copy)"
}

Write-Host "== 2/4 Aligning audio (local, free) =="
if ($Language -ne "") {
    python scripts/align.py --audio $Dest --out align.json --language $Language
} else {
    python scripts/align.py --audio $Dest --out align.json
}
Assert-Success "Aligning audio"

if ($ScriptPath -ne "") {
    Write-Host "== 2b/4 Using your exact script text instead of the auto-transcription =="
    python scripts/inject_script.py --align align.json --script $ScriptPath
    Assert-Success "Injecting script text"
}

Write-Host "== 3/4 Planning scenes with OpenAI (a few cents) =="
$PlanArgs = @("--align", "align.json", "--audio-file", $FileName, "--out", "scenes.generated.json")
if ($RequiredAssets -ne "") { $PlanArgs += @("--required-assets", $RequiredAssets) }
python scripts/plan_scenes.py @PlanArgs
Assert-Success "Planning scenes"

Write-Host "== 4/4 Rendering both formats from the same storyboard (same length as your audio) =="
$Base = [System.IO.Path]::GetFileNameWithoutExtension($OutName)
$VerticalOut = "out/$Base-instagram.mp4"
$LandscapeOut = "out/$Base-youtube.mp4"

Write-Host "  -> vertical 1080x1920 (Instagram/Reels/Shorts)"
npx remotion render src/index.ts MainVideo $VerticalOut --props=scenes.generated.json
Assert-Success "Rendering vertical video"

Write-Host "  -> landscape 1920x1080 (YouTube standard)"
npx remotion render src/index.ts MainVideoYouTube $LandscapeOut --props=scenes.generated.json
Assert-Success "Rendering landscape video"

Write-Host "✅ Done -> $VerticalOut, $LandscapeOut"
