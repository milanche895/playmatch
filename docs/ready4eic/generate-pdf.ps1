# Regenerates docs\Plejko-Ready4EIC-PitchDeck.pdf from pitch-deck.html
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$html = "file:///" + ("$PSScriptRoot\pitch-deck.html" -replace '\\', '/')
$out = Join-Path (Split-Path $PSScriptRoot -Parent) "Plejko-Ready4EIC-PitchDeck.pdf"
if (Test-Path $out) { Remove-Item $out -Force }
& $chrome --headless=new --disable-gpu --no-pdf-header-footer --no-first-run --allow-file-access-from-files --virtual-time-budget=12000 --print-to-pdf="$out" $html
Write-Host "Wrote $out"
