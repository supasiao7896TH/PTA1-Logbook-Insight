@echo off
chcp 65001 >nul
title PTA1 Logbook Insight - Setup New PC (30 Oct 2026)
cd /d "%~dp0\.."
echo ============================================================
echo   PTA1 Logbook Insight - One-Click Setup for New PC
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-new-pc.ps1"
echo.
pause
