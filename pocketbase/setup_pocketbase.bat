@echo off
chcp 65001 >nul
title Konkur - PocketBase setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_pocketbase.ps1" %*
echo.
pause
