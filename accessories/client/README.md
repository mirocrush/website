# Private Editor

A VS Code-like text editor built with Python that **does not appear in screenshots or screen recordings**.

## Features

- VS Code Dark+ theme UI
- Multi-tab editing
- Python syntax highlighting
- File explorer sidebar
- Line numbers with current line highlight
- Auto-indent with smart `:` detection
- Opacity slider (10%–100%)
- Screenshot / screen capture protection (`SetWindowDisplayAffinity`)
- Keyboard shortcuts (`Ctrl+N`, `Ctrl+O`, `Ctrl+S`, `Ctrl+W`, `Ctrl+B`)

## Requirements (to run from source)

- Windows 10 version 2004 (build 19041) or newer
- Python 3.10+
- No extra pip packages required (uses built-in `tkinter` and `ctypes`)

## Run from source

```bash
python index.py
```

Or without a console window:

```bash
pythonw index.py
```

## Build standalone .exe

Run the build script:

```bash
build.bat
```

The output executable will be at:

```
dist/PrivateEditor.exe
```

Copy `dist/PrivateEditor.exe` to any Windows machine and run it — **no Python installation required**.

## Screenshot Protection

This program uses the Windows API `SetWindowDisplayAffinity` with the `WDA_EXCLUDEFROMCAPTURE` flag.
The window is fully visible on your screen but appears **black/blank** in:

- Screenshots (`Win+PrintScreen`, `Snipping Tool`)
- Screen recordings (OBS, Bandicam, etc.)
- Screen shares (Zoom, Teams, Google Meet)

The status bar shows `⚡ Protected` (green) when protection is active.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New tab |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+W` | Close tab |
| `Ctrl+B` | Toggle sidebar |
| `Tab` | Insert 4 spaces |
| `Enter` | Auto-indent |
