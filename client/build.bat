@echo off
title Visual Studio Code - Build
echo ============================================
echo   Visual Studio Code - Build Script
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Please install Python from https://python.org
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
pip install pyinstaller pillow --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo        Done.
echo.

echo [2/4] Generating icon...
python make_icon.py
if errorlevel 1 (
    echo [WARNING] Icon generation failed, building without icon.
    set ICON_FLAG=
) else (
    set ICON_FLAG=--icon=icon.ico
)
echo        Done.
echo.

echo [3/4] Building executable...
:: Kill any running instance first (prevents "Access is denied" on locked exe)
taskkill /f /im vscode.exe >nul 2>&1

pyinstaller --onefile --windowed --name "vscode" --clean ^
    --hidden-import=tkinter ^
    --hidden-import=tkinter.ttk ^
    --hidden-import=tkinter.filedialog ^
    --hidden-import=tkinter.messagebox ^
    %ICON_FLAG% ^
    --add-data "icon.ico;." ^
    index.py
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)
echo        Done.
echo.

echo [4/4] Cleaning up build files...
rmdir /s /q build >nul 2>&1
del /q vscode.spec >nul 2>&1
echo        Done.
echo.

echo ============================================
echo   Build successful!
echo   Output: dist\vscode.exe
echo ============================================
echo.
pause
