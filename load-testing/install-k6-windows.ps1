# PowerShell script to install k6 on Windows
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  k6 Load Testing Tool - Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To run as Administrator:" -ForegroundColor Yellow
    Write-Host "1. Right-click PowerShell" -ForegroundColor Yellow
    Write-Host "2. Select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "3. Run this script again" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Check if k6 is already installed
Write-Host "Checking if k6 is already installed..." -ForegroundColor Yellow
$k6Installed = Get-Command k6 -ErrorAction SilentlyContinue

if ($k6Installed) {
    $version = k6 version
    Write-Host "✅ k6 is already installed: $version" -ForegroundColor Green
    Write-Host ""
    $response = Read-Host "Do you want to reinstall/update k6? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "✅ Installation skipped. k6 is ready to use!" -ForegroundColor Green
        exit 0
    }
}

# Check if Chocolatey is installed
Write-Host "Checking if Chocolatey is installed..." -ForegroundColor Yellow
$chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue

if (-not $chocoInstalled) {
    Write-Host "⚠️  Chocolatey is not installed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Installing Chocolatey..." -ForegroundColor Yellow

    # Install Chocolatey
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072

    try {
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Host "✅ Chocolatey installed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install Chocolatey" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Chocolatey manually from: https://chocolatey.org/install" -ForegroundColor Yellow
        exit 1
    }

    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "✅ Chocolatey is already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installing k6..." -ForegroundColor Yellow

# Install k6 using Chocolatey
try {
    choco install k6 -y
    Write-Host "✅ k6 installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install k6" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please try manual installation from: https://k6.io/docs/get-started/installation/" -ForegroundColor Yellow
    exit 1
}

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host ""
Write-Host "Verifying k6 installation..." -ForegroundColor Yellow

# Verify k6 is installed and working
try {
    $version = k6 version
    Write-Host "✅ k6 is installed and working!" -ForegroundColor Green
    Write-Host "   Version: $version" -ForegroundColor Cyan
} catch {
    Write-Host "❌ k6 was installed but cannot be found in PATH" -ForegroundColor Red
    Write-Host "Please close and reopen PowerShell, then try running: k6 version" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete! 🎉" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure your test script with Supabase credentials" -ForegroundColor White
Write-Host "   File: C:\Srini\dealpro\dev\dealpro\load-testing\stress-test.js" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run a smoke test:" -ForegroundColor White
Write-Host "   cd C:\Srini\dealpro\dev\dealpro\load-testing" -ForegroundColor Gray
Write-Host "   k6 run --vus 10 --duration 1m stress-test.js" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Read the setup guide:" -ForegroundColor White
Write-Host "   SETUP-GUIDE.md" -ForegroundColor Gray
Write-Host ""
Write-Host "Need help? Read: quick-start.md" -ForegroundColor Yellow
Write-Host ""

# Pause to allow user to read the output
Read-Host "Press Enter to exit"
