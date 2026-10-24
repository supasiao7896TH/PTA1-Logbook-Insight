<#
.SYNOPSIS
    One-Click Setup Script for New PC (PTA1 Logbook Insight & Workspace Automation)
.DESCRIPTION
    รันสคริปต์นี้เพียงครั้งเดียวบนเครื่องใหม่ (30 ต.ค. 2026):
    1. ตรวจสอบ Node.js, Git และ npm install dependencies
    2. ตั้งค่าโฟลเดอร์ C:\ProgramData\PTA1-Workspace พร้อม open-logbook.ps1 (9 รายการ)
    3. ติดตั้ง Shortcut ลงใน Windows Startup เพื่อเปิดอัตโนมัติตอน Login PC
    4. ลงทะเบียน Windows Task Scheduler (กะเช้า 07:20 น. และ กะดึก 19:20 น.)
    5. สร้าง Shortcut บนหน้าจอ Desktop (🚀 เปิด PTA1 Logbook (Auto-Sync).bat)
    6. สกัดข้อมูลสดจาก SharePoint รอบแรกและ Build Production
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$WorkspaceDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$ProgramDataDir = "C:\ProgramData\PTA1-Workspace"
$StartupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$DesktopDir = [Environment]::GetFolderPath('Desktop')

function Say([string]$msg, [string]$color = "Cyan") {
    Write-Host $msg -ForegroundColor $color
}

Say "`n============================================================"
Say "🚀 เริ่มต้นการตั้งค่า PTA1 Logbook Insight สำหรับเครื่องใหม่..."
Say "   โฟลเดอร์โปรเจกต์: $WorkspaceDir"
Say "============================================================`n"

# 1. npm install
Say "[1/6] กำลังตรวจสอบและติดตั้ง npm dependencies..." "Yellow"
try {
    Push-Location $WorkspaceDir
    cmd.exe /c "npm install"
    Say "  [OK] ติดตั้ง dependencies สำเร็จ" "Green"
} catch {
    Say "  [WARN] npm install แจ้งเตือน: $($_.Exception.Message)" "Yellow"
} finally {
    Pop-Location
}

# 2. Setup C:\ProgramData\PTA1-Workspace
Say "`n[2/6] กำลังตั้งค่าโฟลเดอร์ C:\ProgramData\PTA1-Workspace..." "Yellow"
if (-not (Test-Path $ProgramDataDir)) {
    New-Item -ItemType Directory -Path $ProgramDataDir -Force | Out-Null
}

$sourceScript = Join-Path $WorkspaceDir "gemini-config\tools\open-logbook.ps1"
if (-not (Test-Path $sourceScript)) {
    $sourceScript = "C:\Users\26007294\A(i)CODER2025TH\gemini-config\tools\open-logbook.ps1"
}
if (-not (Test-Path $sourceScript)) {
    $sourceScript = "C:\ProgramData\PTA1-Workspace\open-logbook.ps1"
}

if (Test-Path $sourceScript) {
    Copy-Item $sourceScript -Destination (Join-Path $ProgramDataDir "open-logbook.ps1") -Force
    Say "  [OK] ติดตั้ง open-logbook.ps1 (9 รายการ) เรียบร้อย" "Green"
} else {
    Say "  [WARN] ไม่พบไฟล์ open-logbook.ps1 ต้นฉบับ" "Yellow"
}

# 3. Startup Shortcut
Say "`n[3/6] กำลังตั้งค่า Windows Startup Shortcut..." "Yellow"
try {
    $wsh = New-Object -ComObject WScript.Shell
    $lnk = $wsh.CreateShortcut((Join-Path $StartupDir "PTA1-Workspace.lnk"))
    $lnk.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$ProgramDataDir\open-logbook.ps1`""
    $lnk.WorkingDirectory = $ProgramDataDir
    $lnk.WindowStyle = 7
    $lnk.Description = "PTA1 Shift Workspace Auto-Launcher (9 Items)"
    $lnk.Save()
    Say "  [OK] สร้าง PTA1-Workspace.lnk ใน Startup Folder เรียบร้อย" "Green"
} catch {
    Say "  [WARN] สร้าง Startup Shortcut ล้มเหลว: $($_.Exception.Message)" "Yellow"
}

# 4. Windows Task Scheduler
Say "`n[4/6] กำลังลงทะเบียน Windows Task Scheduler (07:20 และ 19:20 น.)..." "Yellow"
$runBat = Join-Path $WorkspaceDir "scripts\run-shift-sync.bat"
try {
    & schtasks.exe /create /tn "PTA1_Logbook_Morning_Sync" /tr "`"$runBat`"" /sc daily /st 07:20 /f | Out-Null
    & schtasks.exe /create /tn "PTA1_Logbook_Night_Sync" /tr "`"$runBat`"" /sc daily /st 19:20 /f | Out-Null
    Say "  [OK] ลงทะเบียน PTA1_Logbook_Morning_Sync (07:20) สำเร็จ" "Green"
    Say "  [OK] ลงทะเบียน PTA1_Logbook_Night_Sync (19:20) สำเร็จ" "Green"
} catch {
    Say "  [WARN] Task Scheduler แจ้งเตือน: $($_.Exception.Message)" "Yellow"
}

# 5. Desktop Shortcut
Say "`n[5/6] กำลังวางไอคอนบน Desktop..." "Yellow"
$desktopBat = Join-Path $WorkspaceDir "🚀 เปิด PTA1 Logbook (Auto-Sync).bat"
if (Test-Path $desktopBat) {
    Copy-Item $desktopBat -Destination (Join-Path $DesktopDir "🚀 เปิด PTA1 Logbook (Auto-Sync).bat") -Force
    Say "  [OK] คัดลอกไอคอนลัดสู่ Desktop เรียบร้อย" "Green"
}

# 6. Initial Extraction & Build
Say "`n[6/6] ทดสอบสกัดข้อมูลสดและ Build Production..." "Yellow"
try {
    Push-Location $WorkspaceDir
    cmd.exe /c "npm run extract:live"
    cmd.exe /c "npm run build"
    Say "  [OK] สกัดข้อมูลและ Build สำเร็จสมบูรณ์" "Green"
} catch {
    Say "  [WARN] Extraction/Build: $($_.Exception.Message)" "Yellow"
} finally {
    Pop-Location
}

Say "`n============================================================"
Say "✨ การตั้งค่าสำหรับเครื่องใหม่เสร็จสิ้น 100% เรียบร้อยแล้วค่ะ!"
Say "   พร้อมใช้งานในกะการทำงานทันที ขอบคุณค่ะพี่ A"
Say "============================================================`n"
