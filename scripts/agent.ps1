<#
Interactive assistant for the voice -> video pipeline.

Usage:
  .\scripts\agent.ps1              # shows a menu
  .\scripts\agent.ps1 run          # jump straight to "generate a new video"
  .\scripts\agent.ps1 feedback     # jump straight to "tweak the last video with new notes"
  .\scripts\agent.ps1 render       # jump straight to "just re-render the last storyboard"
  .\scripts\agent.ps1 preview      # open Remotion Studio with the sample data

If PowerShell blocks running local scripts, run once:
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
    [ValidateSet("run", "feedback", "render", "preview", "")]
    [string]$Command = ""
)

$ErrorActionPreference = "Stop"

function Get-FirstMatch($patterns) {
    foreach ($p in $patterns) {
        $f = Get-ChildItem -Path "public" -Filter $p -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($f) { return $f.Name }
    }
    return $null
}

function Read-WithDefault($label, $default) {
    if ($default) {
        $val = Read-Host "$label [Enter = $default]"
    } else {
        $val = Read-Host "$label"
    }
    if ([string]::IsNullOrWhiteSpace($val)) { return $default } else { return $val }
}

# Any image/gif you've dropped into public/assets/ is already "available" to
# the AI director (it may use it if relevant) — this just additionally asks
# which of them, if any, MUST show up somewhere in the video, instead of
# leaving that entirely up to the model's judgment. Shows the real filenames
# so you're picking from what's actually there, not guessing.
function Read-RequiredAssets {
    $files = Get-ChildItem -Path "public/assets" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(png|jpe?g|webp|svg|gif)$' } |
        Select-Object -ExpandProperty Name
    if (-not $files) { return "" }
    Write-Host "`nفایل‌های موجود تو public/assets: $($files -join ', ')"
    return Read-Host "کدوم‌ها حتما باید تو ویدیو استفاده بشن؟ (اسم فایل‌ها با کاما جدا کن، یا خالی بذار)"
}

# External tools (python, npx) don't raise PowerShell terminating errors on
# failure — they just set $LASTEXITCODE. Call this right after every such
# command or a crash silently gets treated as success.
function Assert-Success($step) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ مرحله‌ی '$step' با خطا شکست خورد (کد خروج $LASTEXITCODE). متوقف شد — خروجی بالا رو ببین."
        throw "$step failed with exit code $LASTEXITCODE"
    }
}

# Same storyboard (scenes.generated.json), two composition ids — one call
# per format, both written from a single render step. Naming: "final.mp4"
# becomes "final-instagram.mp4" (vertical, 1080x1920) and "final-youtube.mp4"
# (landscape, 1920x1080).
function Render-BothFormats($outName) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($outName)
    $verticalOut = "out/$base-instagram.mp4"
    $landscapeOut = "out/$base-youtube.mp4"

    Write-Host "  -> vertical 1080x1920 (Instagram/Reels/Shorts)"
    npx remotion render src/index.ts MainVideo $verticalOut --props=scenes.generated.json
    Assert-Success "Rendering vertical video"

    Write-Host "  -> landscape 1920x1080 (YouTube standard)"
    npx remotion render src/index.ts MainVideoYouTube $landscapeOut --props=scenes.generated.json
    Assert-Success "Rendering landscape video"

    Write-Host "`n  -> $verticalOut"
    Write-Host "  -> $landscapeOut"
}

function Invoke-Run {
    $voiceDefault = Get-FirstMatch @("*.mp3", "*.wav", "*.m4a")
    $scriptDefault = Get-FirstMatch @("*.txt")

    Write-Host ""
    $voice = Read-WithDefault "فایل ویس داخل public" $voiceDefault
    if (-not $voice) {
        Write-Host "هیچ فایل ویسی داخل public/ پیدا نشد و چیزی هم وارد نکردی. لغو شد."
        return
    }
    $scriptFile = Read-WithDefault "فایل اسکریپت داخل public (خالی = بدون اسکریپت، فقط تشخیص خودکار)" $scriptDefault
    $outName = Read-WithDefault "اسم فایل خروجی" "final.mp4"
    $language = Read-WithDefault "کد زبان (مثلا fa یا en)" "fa"
    $notes = Read-Host "توضیحات یا نکات اضافه برای کارگردان هوش مصنوعی (اختیاری)"
    $requiredAssets = Read-RequiredAssets

    $voicePath = Join-Path "public" $voice

    Write-Host "`n== 1/3 Aligning audio (local, free) =="
    python scripts/align.py --audio $voicePath --out align.json --language $language
    Assert-Success "Aligning audio"

    if ($scriptFile) {
        Write-Host "== 1b/3 Using your exact script text =="
        python scripts/inject_script.py --align align.json --script (Join-Path "public" $scriptFile)
        Assert-Success "Injecting script text"
    }

    Write-Host "== 2/3 Planning scenes with OpenAI =="
    $planArgs = @("--align", "align.json", "--audio-file", $voice, "--out", "scenes.generated.json")
    if ($notes) { $planArgs += @("--notes", $notes) }
    if ($requiredAssets) { $planArgs += @("--required-assets", $requiredAssets) }
    python scripts/plan_scenes.py @planArgs
    Assert-Success "Planning scenes"

    Write-Host "== 3/3 Rendering both formats from the same storyboard (same length as your audio) =="
    Render-BothFormats $outName

    Write-Host "`n✅ Done"
}

function Invoke-Feedback {
    if (-not (Test-Path "align.json")) {
        Write-Host "اول یک‌بار دستور 'run' رو بزن تا align.json ساخته بشه."
        return
    }

    $align = Get-Content "align.json" -Raw | ConvertFrom-Json
    $audioFileName = Split-Path $align.audio -Leaf

    Write-Host ""
    Write-Host "این حالت صدا رو دوباره تحلیل نمی‌کنه (سریع و رایگان)، فقط با توضیحات جدیدت صحنه‌ها رو دوباره می‌سازه."
    $outName = Read-WithDefault "اسم فایل خروجی جدید" "final-v2.mp4"
    $notes = Read-Host "فیدبک یا تغییری که می‌خوای اعمال بشه"

    if (-not $notes) {
        Write-Host "چیزی ننوشتی، لغو شد."
        return
    }
    $requiredAssets = Read-RequiredAssets

    Write-Host "`n== Re-planning scenes with your feedback =="
    $planArgs = @("--align", "align.json", "--audio-file", $audioFileName, "--out", "scenes.generated.json", "--notes", $notes)
    if ($requiredAssets) { $planArgs += @("--required-assets", $requiredAssets) }
    python scripts/plan_scenes.py @planArgs
    Assert-Success "Planning scenes"

    Write-Host "== Re-rendering (both formats) =="
    Render-BothFormats $outName

    Write-Host "`n✅ Done"
}

function Invoke-RenderOnly {
    if (-not (Test-Path "scenes.generated.json")) {
        Write-Host "هنوز scenes.generated.json نداری — اول یک‌بار 'run' رو بزن."
        return
    }
    $outName = Read-WithDefault "اسم فایل خروجی" "final.mp4"
    Write-Host "`n== Re-rendering from the existing storyboard (no new API cost) =="
    Render-BothFormats $outName
    Write-Host "`n✅ Done"
}

function Invoke-Preview {
    npm run preview
}

function Show-Menu {
    Write-Host ""
    Write-Host "==============================="
    Write-Host " دستیار ساخت ویدیو از روی ویس"
    Write-Host "==============================="
    Write-Host "1) run       - ساخت ویدیوی جدید از روی ویس (همزمان یوتیوب + اینستاگرام)"
    Write-Host "2) feedback  - اصلاح آخرین ویدیو با توضیحات جدید (بدون تحلیل دوباره صدا)"
    Write-Host "3) render    - فقط رندر دوباره از همون صحنه‌های قبلی، هر دو فرمت (بدون هیچ هزینه‌ای)"
    Write-Host "4) preview   - پیش‌نمایش استایل با داده نمونه"
    Write-Host "5) exit"
    $choice = Read-Host "`nانتخابت؟ (1-5)"
    switch ($choice) {
        "1" { Invoke-Run }
        "2" { Invoke-Feedback }
        "3" { Invoke-RenderOnly }
        "4" { Invoke-Preview }
        default { return }
    }
}

try {
    if ($Command -eq "") {
        Show-Menu
    } else {
        switch ($Command) {
            "run" { Invoke-Run }
            "feedback" { Invoke-Feedback }
            "render" { Invoke-RenderOnly }
            "preview" { Invoke-Preview }
        }
    }
} catch {
    Write-Host "`nمتوقف شد به‌خاطر خطای بالا."
    exit 1
}
