# PowerShell script to move google-services.json to the correct location
# Run this after downloading google-services.json from Firebase Console

$sourceFile = "$env:USERPROFILE\Downloads\google-services.json"
$targetDir = "C:\Srini\dealpro\dev\dealpro\android\app"
$targetFile = "$targetDir\google-services.json"

Write-Host "Moving google-services.json to Android app directory..." -ForegroundColor Cyan

# Check if source file exists
if (Test-Path $sourceFile) {
    # Move the file
    Move-Item -Path $sourceFile -Destination $targetFile -Force
    Write-Host "✅ Success! google-services.json moved to:" -ForegroundColor Green
    Write-Host "   $targetFile" -ForegroundColor Gray

    # Verify it's there
    if (Test-Path $targetFile) {
        Write-Host "✅ File verified at correct location" -ForegroundColor Green
        Write-Host "`nNext steps:" -ForegroundColor Yellow
        Write-Host "1. Run: npm run build" -ForegroundColor White
        Write-Host "2. Run: npx cap sync android" -ForegroundColor White
        Write-Host "3. Run: npx cap open android" -ForegroundColor White
    }
} else {
    Write-Host "❌ Error: google-services.json not found in Downloads folder" -ForegroundColor Red
    Write-Host "`nPlease:" -ForegroundColor Yellow
    Write-Host "1. Go to Firebase Console" -ForegroundColor White
    Write-Host "2. Add Android app if you haven't" -ForegroundColor White
    Write-Host "3. Download google-services.json" -ForegroundColor White
    Write-Host "4. Run this script again" -ForegroundColor White
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
