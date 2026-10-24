@echo off
title The 70's Bistro server
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
    echo Python is not installed. Install it from https://www.python.org/downloads/ and run this again.
    pause
    exit /b 1
)
start "" http://localhost:8000/
python server.py
pause
