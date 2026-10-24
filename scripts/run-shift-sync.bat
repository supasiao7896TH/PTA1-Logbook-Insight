@echo off
chcp 65001 >nul
cd /d "C:\Users\26007294\A(i)CODER2025TH\PTA1-Logbook-Insight"
if not exist "scratch" mkdir "scratch"
echo ============================================================ >> "scratch\shift-sync.log"
echo Auto-Sync Shift Triggered at %DATE% %TIME% >> "scratch\shift-sync.log"
call npm run sync:deploy >> "scratch\shift-sync.log" 2>&1
