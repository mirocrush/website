@echo off
title Visual Studio Code - Build
echo ============================================
echo   Visual Studio Code Messenger - Build
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
pip install pyinstaller pillow requests websocket-client pystray tkinterdnd2 --quiet
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
taskkill /f /im code.exe >nul 2>&1

pyinstaller --onefile --windowed --name "code" --clean ^
    --hidden-import=tkinter ^
    --hidden-import=tkinter.ttk ^
    --hidden-import=tkinter.messagebox ^
    --hidden-import=requests ^
    --hidden-import=websocket ^
    --hidden-import=websocket._app ^
    --hidden-import=websocket._core ^
    --hidden-import=pystray ^
    --hidden-import=pystray._win32 ^
    --hidden-import=tkinterdnd2 ^
    %ICON_FLAG% ^
    --add-data "icon.ico;." ^
    --hidden-import=PIL ^
    --hidden-import=PIL.Image ^
    --hidden-import=PIL.ImageTk ^
    --hidden-import=PIL._imaging ^
    messenger.py

if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)
echo        Done.
echo.

echo [4/4] Cleaning up build files...
rmdir /s /q build >nul 2>&1
del /q messenger.spec >nul 2>&1
echo        Done.
echo.

echo ============================================
echo   Build successful!
echo   Output: dist\code.exe
echo   App:    Visual Studio Code Messenger
echo ============================================
echo.
pause
